const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Información del panel de control
 */

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Obtiene estadísticas generales
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 */
router.get('/stats', dashboardController.getStats);

/**
 * @swagger
 * /dashboard/charts:
 *   get:
 *     summary: Obtiene datos para gráficos
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Datos para gráficos
 */
router.get('/charts', dashboardController.getCharts);

module.exports = router;