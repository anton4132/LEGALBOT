const express = require('express');
const dotenv = require('dotenv');
const prisma = require('./prisma');

dotenv.config();
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API lista y funcionando');
});

app.get('/usuarios', async (req, res) => {
  const usuarios = await prisma.usuario.findMany(); // ajusta con tu modelo real
  res.json(usuarios);
});

app.listen(3000, () => {
  console.log('Servidor activo en http://localhost:3000');
});
