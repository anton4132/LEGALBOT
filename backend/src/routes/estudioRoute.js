const express = require('express');
const router = express.Router();
const estudioController = require('../controllers/estudioController');

router.get('/', estudioController.searchEstudios);
router.post('/', estudioController.createEstudio);

module.exports = router;