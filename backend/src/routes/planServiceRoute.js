const express = require('express');
const router = express.Router();
const planServiceController = require('../controllers/planServiceController');

router.post('/', planServiceController.createPlanService);
router.put('/:id', planServiceController.updatePlanService);
router.delete('/:id', planServiceController.deletePlanService);

module.exports = router;