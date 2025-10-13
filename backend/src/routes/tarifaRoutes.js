const express = require('express');
const controller = require('../controllers/tarifaController');

const router = express.Router();

router.get('/', controller.getTarifas);
router.get('/catalogs', controller.getCatalogs);
router.get('/:id', controller.getTarifa);
router.post('/', controller.createTarifa);
router.put('/:id', controller.updateTarifa);
router.post('/:id/clone', controller.cloneTarifa);
router.post('/:id/toggle', controller.toggleTarifa);
router.post('/simular', controller.simulateTarifa);

module.exports = router;