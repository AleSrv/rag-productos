let productos = [];
let productoSeleccionado = null;

function resetear() {
  productoSeleccionado = null;
  document.getElementById('chat').innerHTML = '';
  document.getElementById('paso1').style.display = 'block';
  document.getElementById('paso2').style.display = 'none';
}

/* =========================
   PRODUCTOS
========================= */
async function cargarProductos() {
  try {
    const res = await fetch('/api/productos');
    productos = await res.json();
    renderProductos(productos);
  } catch {
    document.getElementById('lista-productos').innerHTML =
      '<p>Error cargando productos</p>';
  }
}

function renderProductos(lista) {
  const c = document.getElementById('lista-productos');
  if (lista.length === 0) {
    c.innerHTML = '<p>No encontrado</p>';
    return;
  }
  c.innerHTML = lista.map(p => `
    <button class="producto-btn"
      onclick="seleccionarProducto('${p.archivo}', '${p.nombre}')">
      ${p.nombre}
    </button>
  `).join('');
}

function filtrarProductos() {
  const q = document.getElementById('buscador').value.toLowerCase();
  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(q) ||
    p.archivo.toLowerCase().includes(q)
  );
  renderProductos(filtrados);
}

function seleccionarProducto(archivo, nombre) {
  productoSeleccionado = archivo;
  document.getElementById('producto-nombre').textContent = nombre;
  document.getElementById('paso1').style.display = 'none';
  document.getElementById('paso2').style.display = 'block';
}

/* =========================
   CHAT
========================= */
function agregarBurbuja(texto, tipo) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = `burbuja ${tipo}`;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function cambiarProducto() {
  resetear();
}

async function preguntar() {
  const input = document.getElementById('input');
  const btn = document.getElementById('enviar-btn');
  const pregunta = input.value.trim();

  if (!pregunta || !productoSeleccionado) return;

  agregarBurbuja(pregunta, 'usuario');
  input.value = '';
  btn.disabled = true;
  btn.textContent = '...';

  const burbuja = agregarBurbuja('', 'bot');

  try {
    const res = await fetch('/api/preguntar-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pregunta,
        archivo: productoSeleccionado
      })
    });

    if (!res.ok) {
      burbuja.textContent = 'Error al conectar con el servidor.';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textoRespuesta = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parsear líneas SSE del buffer
      const lineas = buffer.split('\n');
      // La última línea puede estar incompleta, la guardamos en buffer
      buffer = lineas.pop();

      for (const linea of lineas) {
        if (!linea.startsWith('data: ')) continue;

        const contenido = linea.slice(6).trim(); // quitar "data: "

        if (contenido === '[DONE]') break;

        try {
          const parsed = JSON.parse(contenido);

          if (parsed.token) {
            textoRespuesta += parsed.token;
            burbuja.textContent = textoRespuesta;
            // Auto-scroll
            const chat = document.getElementById('chat');
            chat.scrollTop = chat.scrollHeight;
          }

          if (parsed.error) {
            burbuja.textContent = 'No se pudo obtener respuesta del modelo.';
          }

        } catch (e) {
          // línea SSE no parseable, ignorar
        }
      }
    }

    // Si no llegó ningún token
    if (!textoRespuesta) {
      burbuja.textContent = 'Sin respuesta del modelo.';
    }

  } catch (err) {
    console.error('Error en preguntar():', err);
    burbuja.textContent = 'Error de conexión.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
}

/* INIT */
document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
  document.getElementById('input').addEventListener('keypress', e => {
    if (e.key === 'Enter') preguntar();
  });
});
