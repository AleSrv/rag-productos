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

// 📦 LISTAR PRODUCTOS
router.get('/api/productos', (req, res) => {
  const docs = db.prepare('SELECT DISTINCT archivo FROM documentos ORDER BY archivo').all();

  const productos = docs.map(d => ({
    archivo: d.archivo,
    nombre: d.archivo
      .replace('FICHA_TV_A4_', '')
      .replace('FICHA_A4_', '')
      .replace('.pdf', '')
      .replace(/[()_]/g, ' ')
      .trim()
  }));

  res.json(productos);
});

// 🤖 RAG STREAM
router.post('/api/preguntar-stream', async (req, res) => {
  console.log('Peticion:', req.body);

  const { pregunta, archivo } = req.body;

  if (!pregunta || !archivo) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  const docs = db.prepare('SELECT texto, embedding FROM documentos WHERE archivo = ?').all(archivo);

  if (docs.length === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  // 🧠 EMBEDDING DE LA PREGUNTA
  const preguntaLimpia = normalizarPregunta(pregunta);
  const preguntaEmbedding = await obtenerEmbedding(preguntaLimpia);

  // 📊 RANKING
  const resultados = docs.map(doc => {
    const emb = JSON.parse(doc.embedding);

    return {
      texto: doc.texto,
      score: cosineSimilarity(preguntaEmbedding, emb)
    };
  });

  resultados.sort((a, b) => b.score - a.score);

  console.log('🧠 Top scores:', resultados.slice(0, 3).map(r => r.score));

  // 📄 CONTEXTO
  const TOP_K = 3;
  const MAX_CHARS = 2000;

  let contexto = resultados
    .slice(0, TOP_K)
    .map(r => r.texto)
    .join('\n\n');

  if (contexto.length > MAX_CHARS) {
    contexto = contexto.slice(0, MAX_CHARS);
  }

  // 🌊 STREAM HEADERS
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let receivedTokens = false;

  try {
    // 🤖 LLAMADA A OLLAMA (LOCAL)
    const iaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen2.5:1.5b',
        prompt: `Eres un asistente tecnico de Samsung.
Responde en español de forma concisa.
Usa SOLO la información de la ficha.
Si el dato no aparece responde: "Este dato no figura en la ficha."

FICHA:
${contexto}

PREGUNTA:
${pregunta}`,
        stream: true
      })
    });

    let buffer = '';

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
          console.log('⚠️ parse error');
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
