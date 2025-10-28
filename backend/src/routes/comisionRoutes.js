const express = require('express');
const controller = require('../controllers/comisionController');

const router = express.Router();

router.get('/', controller.getComisiones);
router.get('/:id', controller.getComision);
router.post('/', controller.createComision);
router.put('/:id', controller.updateComision);
router.patch('/:id', controller.patchComision);
router.post('/:id/clone', controller.cloneComision);
router.post('/:id/toggle', controller.toggleComision);

module.exports = router;