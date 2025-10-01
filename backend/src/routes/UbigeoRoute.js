const express = require('express');
const router = express.Router();
const ubigeoController = require('../controllers/UbigeoController');

router.get('/departamentos', ubigeoController.listDepartamentos);
router.get(
  '/departamentos/:departamentoCodigo/provincias',
  ubigeoController.listProvincias,
);
router.get(
  '/provincias/:provinciaCodigo/distritos',
  ubigeoController.listDistritos,
);

module.exports = router;