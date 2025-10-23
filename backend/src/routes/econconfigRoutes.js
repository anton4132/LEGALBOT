const express = require('express');
const controller = require('../controllers/econconfigController');

const router = express.Router();

router.get('/', controller.getActiveConfig);
router.put('/', controller.saveConfig);
router.post('/', controller.saveConfig);

module.exports = router;