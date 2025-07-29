const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/database');

// Importar rutas
const apiRoutes = require('./routes');

// Configurar variables de entorno
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../../admin-web')));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API lista y funcionando');
});

// Ruta para servir login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-web/login.html'));
});

// Ruta para servir index.html (dashboard)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-web/index.html'));
});

// API Routes
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

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

module.exports = app;