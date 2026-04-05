/**
 * pdf-a-texto.js
 * Convierte PDFs de fichas técnicas Samsung a Markdown limpio
 * usando Gemini API (visión). Guarda resultado en /textos/
 *
 * Uso: node pdf-a-texto.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const PDFS_DIR = path.join(__dirname, 'pdfs');
const TEXTOS_DIR = path.join(__dirname, 'textos');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const DELAY_MS = 15000; 

if (!GEMINI_API_KEY) {
  console.error('❌ Falta GEMINI_API_KEY en el archivo .env');
  process.exit(1);
}

// Crear carpeta /textos si no existe
if (!fs.existsSync(TEXTOS_DIR)) {
  fs.mkdirSync(TEXTOS_DIR);
  console.log('📁 Carpeta /textos creada');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pdfATexto(rutaPDF) {
  const nombreArchivo = path.basename(rutaPDF);
  const nombreSalida = nombreArchivo.replace('.pdf', '.txt');
  const rutaSalida = path.join(TEXTOS_DIR, nombreSalida);

  // Si ya existe el .txt, saltar
  if (fs.existsSync(rutaSalida)) {
    console.log(`⏭️  Ya procesado: ${nombreArchivo}`);
    return true;
  }

  // Leer PDF y convertir a base64
  const pdfBuffer = fs.readFileSync(rutaPDF);
  const pdfBase64 = pdfBuffer.toString('base64');

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            text: `Eres un experto en fichas técnicas de televisores Samsung.
Extrae TODA la información de este PDF y conviértela a Markdown estructurado.

Sigue estas reglas:
- Usa ## para secciones principales (Imagen, Sonido, Smart TV, Conectividad, Dimensiones...)
- Usa listas con - para especificaciones
- Convierte tablas en listas clave: valor
- Escribe los Hz como "hercios" (ej: 120 hercios)
- Escribe los W como "vatios" (ej: 20 vatios)
- Incluye el nombre del modelo y todas las especificaciones técnicas
- No omitas ningún dato técnico aunque parezca secundario
- No añadas texto que no esté en el PDF`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096
    }
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Error API para ${nombreArchivo}:`, err.slice(0, 200));
      return false;
    }

    const data = await res.json();

    // Extraer texto de la respuesta
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      console.error(`  ❌ Respuesta vacía para ${nombreArchivo}`);
      console.error('  Raw:', JSON.stringify(data).slice(0, 300));
      return false;
    }

    // Guardar .txt
    fs.writeFileSync(rutaSalida, texto, 'utf8');
    console.log(`  ✅ Guardado: ${nombreSalida} (${texto.length} chars)`);
    return true;

  } catch (err) {
    console.error(`  ❌ Error procesando ${nombreArchivo}:`, err.message);
    return false;
  }
}

async function main() {
  const pdfs = fs.readdirSync(PDFS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(PDFS_DIR, f))
    .sort();

  console.log(`\n🚀 Procesando ${pdfs.length} PDFs con Gemini...\n`);

  let ok = 0;
  let error = 0;
  let saltados = 0;

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    const nombre = path.basename(pdf);
    console.log(`[${i + 1}/${pdfs.length}] ${nombre}`);

    const nombreSalida = nombre.replace('.pdf', '.txt');
    const rutaSalida = path.join(TEXTOS_DIR, nombreSalida);

    if (fs.existsSync(rutaSalida)) {
      saltados++;
      console.log(`⏭️  Ya procesado`);
      continue;
    }

    const exito = await pdfATexto(pdf);

    if (exito) {
      ok++;
    } else {
      error++;
    }

    // Esperar entre peticiones para no superar el límite
    if (i < pdfs.length - 1) {
      process.stdout.write(`  ⏳ Esperando ${DELAY_MS / 1000}s...\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`  ✅ Procesados: ${ok}`);
  console.log(`  ⏭️  Saltados (ya existían): ${saltados}`);
  console.log(`  ❌ Errores: ${error}`);
  console.log(`\nTextos guardados en: ${TEXTOS_DIR}`);
}

main().catch(console.error);
