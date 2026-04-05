require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const Database = require('better-sqlite3');

const router = express.Router();
const db = new Database('/home/ubuntu/rag-productos/productos.db');

function normalizarPregunta(p) {
  return p
    .toLowerCase()
    .replace('herzios', 'hercios')
    .replace('hz', 'hercios');
}

// 🔎 EMBEDDINGS (OLLAMA)
async function obtenerEmbedding(texto) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: texto
    })
  });

  const data = await res.json();
  return data.embedding;
}

// 📊 SIMILITUD COSENO
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 🤖 RAG STREAM
router.post('/api/preguntar-stream', async (req, res) => {
  console.log('Peticion:', req.body);

  const { pregunta, archivo } = req.body;

  if (!pregunta || !archivo) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  // Buscar en tabla 'chunks'
  const chunks = db.prepare(`
    SELECT archivo, chunk_index, texto, embedding
    FROM chunks
    WHERE archivo = ?
  `).all(archivo);

  if (chunks.length === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  // 🧠 EMBEDDING DE LA PREGUNTA
  const preguntaLimpia = normalizarPregunta(pregunta);
  const preguntaEmbedding = await obtenerEmbedding(preguntaLimpia);

  // 📊 RANKING por similitud coseno
  const resultados = chunks.map(chunk => {
    const emb = JSON.parse(chunk.embedding);
    return {
      texto: chunk.texto,
      chunk_index: chunk.chunk_index,
      score: cosineSimilarity(preguntaEmbedding, emb)
    };
  });

  resultados.sort((a, b) => b.score - a.score);

  console.log('🧠 Top scores:', resultados.slice(0, 3).map(r => r.score.toFixed(4)));

  // Filtrar chunks con score insuficiente
  const SCORE_MINIMO = 0.55;
  const resultadosFiltrados = resultados.filter(r => r.score >= SCORE_MINIMO);

  // Si no hay chunks relevantes, responder sin llamar al modelo
  if (resultadosFiltrados.length === 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ token: 'Este dato no figura en la ficha.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  // 📄 Top 3 chunks ordenados por posición natural en el PDF
  const contexto = resultadosFiltrados
    .slice(0, 3)
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map(r => r.texto)
    .join('\n\n---\n\n');

  // 🌊 STREAM HEADERS
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let receivedTokens = false;

  try {
    // 🤖 LLAMADA A OLLAMA (LOCAL)
    const iaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:1.5b',
        prompt: `Eres un asistente tecnico de Samsung.
Responde en español de forma concisa.
Usa SOLO la información de la ficha técnica proporcionada.
No inventes datos. Si el dato no aparece en la ficha responde exactamente: "Este dato no figura en la ficha."

FICHA:
${contexto}

PREGUNTA:
${pregunta}`,
        stream: true
      })
    });

    iaRes.body.on('data', chunk => {
      const lines = chunk.toString().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.response) {
            receivedTokens = true;
            res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`);
          }

          if (parsed.done) {
            res.write('data: [DONE]\n\n');
            return res.end();
          }

        } catch (err) {
          console.log('⚠️ parse error en línea:', line);
        }
      }
    });

    iaRes.body.on('end', () => {
      if (!receivedTokens) {
        res.write(`data: ${JSON.stringify({ error: 'stream_vacio' })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });

    iaRes.body.on('error', err => {
      console.error('❌ stream error:', err);
      res.end();
    });

  } catch (err) {
    console.error('❌ Error general:', err.message);
    res.end();
  }
});

module.exports = router;
