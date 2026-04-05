const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const PDFS_DIR = './pdfs';
const db = new Database('./productos.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archivo TEXT,
    texto TEXT,
    embedding TEXT
  )
`);

const insert = db.prepare('INSERT INTO documentos (archivo, texto, embedding) VALUES (?, ?, ?)');

function chunkTexto(texto, size = 800, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < texto.length; i += (size - overlap)) {
    chunks.push(texto.slice(i, i + size));
  }
  return chunks;
}

async function generarEmbedding(texto) {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: texto
    })
  });

  const data = await response.json();
  return JSON.stringify(data.embedding);
}

async function indexar() {
  const archivos = fs.readdirSync(PDFS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Indexando ${archivos.length} PDFs...`);

  for (const archivo of archivos) {
    const ruta = path.join(PDFS_DIR, archivo);

    try {
      const texto = execSync(`pdftotext "${ruta}" -`, { encoding: 'utf8' }).trim();

      if (texto.length < 10) {
        console.log(`⚠ ${archivo} — sin texto`);
        continue;
      }

      const chunks = chunkTexto(texto);

      for (const chunk of chunks) {
        const embedding = await generarEmbedding(chunk);
        insert.run(archivo, chunk, embedding);
      }

      console.log(`✓ ${archivo} (${chunks.length} chunks)`);

    } catch (e) {
      console.log(`✗ ${archivo} — ${e.message}`);
    }
  }

  console.log('Indexación completada');
  db.close();
}

indexar().catch(console.error);
