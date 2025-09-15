const express = require('express');
const router = express.Router();

// Importar sub-routers
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const serviceRoutes = require('./serviceRoutes');
const especialidadRoutes = require('./especialidadRoute');
const estudioRoutes = require('./estudioRoute');

// Importar controlador SOLO para endpoints sueltos como /dni
const userController = require('../controllers/userController');


// Montaje de sub-routers
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);     // /api/users/...
router.use('/roles', roleRoutes);     // /api/roles/...
router.use('/services', serviceRoutes);
router.use('/especialidades', especialidadRoutes);
router.use('/estudios', estudioRoutes);

/**
 * @swagger
 * /dni/{dni}:
 *   get:
 *     summary: Consulta información de un DNI
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: dni
 *         schema:
 *           type: string
 *         required: true
 *         description: Número de DNI a consultar
 *     responses:
 *       200:
 *         description: Información del DNI
 */
router.get('/dni/:dni', userController.lookupDni); // /api/dni/:dni

module.exports = router;
