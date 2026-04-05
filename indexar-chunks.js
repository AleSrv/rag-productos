/**
 * indexar-chunks.js
 * Lee los .txt generados por Gemini desde /textos/
 * y los indexa en la tabla 'chunks' con embeddings de Ollama
 */

const Database = require('better-sqlite3');
const { chunkPorSecciones } = require('./chunker');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'productos.db');
const TEXTOS_DIR = path.join(__dirname, 'textos');
const OLLAMA_URL = 'http://localhost:11434/api/embeddings';
const EMBED_MODEL = 'nomic-embed-text';

const db = new Database(DB_PATH);

async function generarEmbedding(texto) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: texto })
  });
  const data = await res.json();
  return data.embedding;
}

async function indexarArchivo(rutaTxt) {
  const nombreTxt = path.basename(rutaTxt);
  const nombrePDF = nombreTxt.replace('.txt', '.pdf');

  // Limpiar chunks previos
  db.prepare('DELETE FROM chunks WHERE archivo = ?').run(nombrePDF);

  const texto = fs.readFileSync(rutaTxt, 'utf8');

  if (!texto || texto.trim().length < 50) {
    console.log(`  ⏭️  Saltando ${nombreTxt} (vacío)`);
    return 0;
  }

  const chunks = chunkPorSecciones(texto, 20);
  console.log(`  📄 ${nombrePDF} → ${chunks.length} chunks`);

  const stmt = db.prepare(`
    INSERT INTO chunks (archivo, chunk_index, texto, embedding)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generarEmbedding(chunks[i]);
    stmt.run(nombrePDF, i, chunks[i], JSON.stringify(embedding));
    process.stdout.write(`\r    chunk ${i + 1}/${chunks.length}`);
  }

  console.log('');
  return chunks.length;
}

async function main() {
  if (!fs.existsSync(TEXTOS_DIR)) {
    console.error('❌ No existe la carpeta /textos. Ejecuta primero pdf-a-texto.js');
    process.exit(1);
  }

  const txts = fs.readdirSync(TEXTOS_DIR)
    .filter(f => f.toLowerCase().endsWith('.txt'))
    .map(f => path.join(TEXTOS_DIR, f))
    .sort();

  if (txts.length === 0) {
    console.error('❌ No hay archivos .txt en /textos');
    process.exit(1);
  }

  console.log(`\n🚀 Indexando ${txts.length} archivos de texto...\n`);

  let totalChunks = 0;
  for (const txt of txts) {
    totalChunks += await indexarArchivo(txt);
  }

  const total = db.prepare('SELECT COUNT(*) as n FROM chunks').get();
  console.log(`\n✅ Indexación completa.`);
  console.log(`   Archivos procesados: ${txts.length}`);
  console.log(`   Chunks generados: ${totalChunks}`);
  console.log(`   Total en DB: ${total.n}`);

  db.close();
}

main().catch(console.error);
