const express = require('express');
const controller = require('../controllers/tarifaController');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.targetTipo = 'comision';
  if (req.method === 'GET') {
    req.query = { ...req.query, tipo: 'comision' };
  } else if (req.body && typeof req.body === 'object') {
    req.body = { ...req.body, tipo: 'comision' };
  }
  next();
});

router.get('/', controller.getTarifas);
router.get('/:id', controller.getTarifa);
router.post('/', controller.createTarifa);
router.put('/:id', controller.updateTarifa);
router.patch('/:id', controller.patchTarifa);
router.post('/:id/clone', controller.cloneTarifa);
router.post('/:id/toggle', controller.toggleTarifa);

module.exports = router;
