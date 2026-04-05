const express = require('express');
const app = express();

app.use(express.json());
app.use(require('./buscar'));

const path = require('path');
app.use(express.static(path.join(__dirname)));

app.listen(3001, () => {
  console.log('RAG server corriendo en puerto 3001');
});
