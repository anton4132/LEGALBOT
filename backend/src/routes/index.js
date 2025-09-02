const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const serviceRoutes = require('./serviceRoutes');
// Definir rutas
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/services', serviceRoutes);

module.exports = router;