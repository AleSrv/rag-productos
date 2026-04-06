const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Ruta raíz → redirige al chat
app.get('/', (req, res) => {
  res.redirect('/chat.html');
});

// Rutas del RAG (buscar.js)
app.use(require('./buscar'));

// Archivos estáticos (chat.html, css/, js/)
app.use(express.static(path.join(__dirname)));

app.listen(3001, () => {
  console.log('RAG server corriendo en puerto 3001');
});
