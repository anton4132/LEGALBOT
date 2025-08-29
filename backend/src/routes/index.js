const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');

// Definir rutas
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);

module.exports = router;