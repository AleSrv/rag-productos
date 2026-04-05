let productos = [];
let productoSeleccionado = null;
let streamActivo = null;

function resetear() {
  if (streamActivo) {
    streamActivo.cancel();
    streamActivo = null;
  }

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

async function preguntar() {
  const input = document.getElementById('input');
  const pregunta = input.value.trim();

  if (!pregunta || !productoSeleccionado) return;

  agregarBurbuja(pregunta, 'usuario');
  input.value = '';

  const res = await fetch('/api/preguntar-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pregunta,
      archivo: productoSeleccionado
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let texto = '';
  let burbuja = agregarBurbuja('', 'bot');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    texto += chunk;
    burbuja.textContent = texto;
  }
}

/* INIT */
document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();

  document.getElementById('input').addEventListener('keypress', e => {
    if (e.key === 'Enter') preguntar();
  });
});
