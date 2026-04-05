/**
 * chunker.js
 * Divide texto en fragmentos semánticos con overlap
 * para mejorar precisión de búsqueda por embeddings
 */

// Para Markdown con secciones ## — ideal para fichas técnicas de Gemini
function chunkPorSecciones(texto, maxLineasPorSeccion = 20) {
  const lineas = texto.split('\n');
  const chunks = [];
  let buffer = [];
  let seccionActual = '';

  for (const linea of lineas) {
    if (linea.startsWith('## ')) {
      // Nueva sección — guardar buffer anterior si tiene contenido
      if (buffer.length > 0) {
        chunks.push(buffer.join('\n').trim());
      }
      seccionActual = linea;
      buffer = [linea];
    } else if (linea.startsWith('# ')) {
      // Título principal — lo añadimos al buffer sin cortar
      buffer.unshift(linea); // al principio para contexto
    } else {
      buffer.push(linea);

      // Si el buffer crece demasiado, cortar conservando el header
      if (buffer.length >= maxLineasPorSeccion) {
        chunks.push(buffer.join('\n').trim());
        // Siguiente chunk empieza con el header de sección para contexto
        buffer = seccionActual ? [seccionActual] : [];
      }
    }
  }

  if (buffer.length > 0 && buffer.join('').trim().length > 20) {
    chunks.push(buffer.join('\n').trim());
  }

  return chunks;
}

// Para PDFs extraídos con pdftotext (texto con párrafos)
function chunkTexto(texto, maxChars = 300, overlap = 50) {
  const normalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const parrafos = normalizado
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 30);

  const chunks = [];
  let buffer = '';

  for (const parrafo of parrafos) {
    const candidato = buffer ? buffer + '\n\n' + parrafo : parrafo;

    if (candidato.length > maxChars) {
      if (buffer) {
        chunks.push(buffer.trim());
        const overlapText = buffer.slice(-overlap);
        buffer = overlapText + '\n\n' + parrafo;
      } else {
        const lineas = parrafo.split('\n').filter(l => l.trim().length > 0);
        let subBuffer = '';
        for (const linea of lineas) {
          if ((subBuffer + '\n' + linea).length > maxChars) {
            if (subBuffer) chunks.push(subBuffer.trim());
            subBuffer = linea;
          } else {
            subBuffer += '\n' + linea;
          }
        }
        if (subBuffer.trim()) buffer = subBuffer.trim();
      }
    } else {
      buffer = candidato;
    }
  }

  if (buffer.trim().length > 30) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

// Para textos Markdown estructurados (generados por Gemini)
// Agrupa por bloques de N líneas con overlap para fichas técnicas
function chunkPorLineas(texto, lineasPorChunk = 12, overlap = 3) {
  const lineas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const chunks = [];

  for (let i = 0; i < lineas.length; i += (lineasPorChunk - overlap)) {
    const chunk = lineas.slice(i, i + lineasPorChunk).join('\n');
    if (chunk.trim().length > 20) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

module.exports = { chunkTexto, chunkPorLineas, chunkPorSecciones };
