const express = require('express');
const controller = require('../controllers/tarifaController');

const router = express.Router();

router.get('/', controller.getTarifas);
router.get('/catalogs', controller.getCatalogs);
router.get('/:id', controller.getTarifa);
router.post('/', controller.createTarifa);
router.put('/:id', controller.updateTarifa);
router.patch('/:id', controller.patchTarifa);

module.exports = router;
