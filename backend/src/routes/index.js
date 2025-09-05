const express = require('express');
const router = express.Router();

// Importar sub-routers
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const serviceRoutes = require('./serviceRoutes');

// Importar controlador SOLO para endpoints sueltos como /dni
const userController = require('../controllers/userController');

// Montaje de sub-routers
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);     // /api/users/...
router.use('/roles', roleRoutes);     // /api/roles/...
router.use('/services', serviceRoutes);

// Endpoints sueltos
router.get('/dni/:dni', userController.lookupDni); // /api/dni/:dni

module.exports = router;
