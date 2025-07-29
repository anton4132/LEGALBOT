const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Rutas del dashboard
router.get('/stats', dashboardController.getStats);
router.get('/charts', dashboardController.getCharts);

module.exports = router;