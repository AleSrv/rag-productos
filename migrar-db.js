/**
 * migrar-db.js
 * Crea la nueva tabla 'chunks' sin tocar la tabla 'documentos' existente
 * Puedes ejecutar esto sin riesgo — no borra nada
 */

const Database = require('better-sqlite3');
const path = require('path');

// Ajusta esta ruta si tu DB tiene otro nombre
const DB_PATH = path.join(__dirname, 'productos.db');
const db = new Database(DB_PATH);

console.log('Iniciando migración...');

db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archivo TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    texto TEXT NOT NULL,
    embedding TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_archivo ON chunks(archivo);
`);

// Verificar
const info = db.prepare("SELECT COUNT(*) as total FROM chunks").get();
console.log(`✅ Tabla 'chunks' lista. Registros actuales: ${info.total}`);

db.close();
