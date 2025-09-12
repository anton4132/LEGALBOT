const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/database');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');


// Importar rutas
const apiRoutes = require('./routes');

// Configurar variables de entorno
dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../../admin-web')));

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API lista y funcionando');
});

// Ruta para servir login.html
app.get('/login', (req, res) => {
  console.log('Accediendo a /login');
  res.sendFile(path.join(__dirname, '../../admin-web/login.html'));
});

// Ruta para servir index.html (dashboard)
app.get('/dashboard', (req, res) => {
  console.log('Accediendo a /dashboard');
  res.sendFile(path.join(__dirname, '../../admin-web/index.html'));
});

// Ruta para servir usuarios.html
app.get('/usuarios', (req, res) => {
  console.log('Accediendo a /usuarios');
  res.sendFile(path.join(__dirname, '../../admin-web/pages/usuarios.html'));
});

// Ruta para servir Tarifas.html
app.get('/Tarifas', (req, res) => {
  console.log('Accediendo a /Tarifas');
  res.sendFile(path.join(__dirname, '../../admin-web/pages/Tarifas.html'));
});

// Ruta para servir servicios.html
app.get('/servicios', (req, res) => {
  console.log('Accediendo a /servicios');
  res.sendFile(path.join(__dirname, '../../admin-web/pages/servicios.html'));
});



app.use('/api', apiRoutes);

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Middleware para rutas no encontradas - DEBE estar al final
app.use('*', (req, res) => {
  console.log('Ruta no encontrada:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

module.exports = app;