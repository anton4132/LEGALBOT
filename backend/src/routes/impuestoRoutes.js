const express = require('express');
const controller = require('../controllers/impuestoController');

const router = express.Router();

router.get('/', controller.listImpuestos);
router.post('/', controller.createImpuesto);
router.put('/:id', controller.updateImpuesto);
router.delete('/:id', controller.deleteImpuesto);

module.exports = router;