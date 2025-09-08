const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);

module.exports = router;