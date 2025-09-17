const express = require('express');
const { authenticate } = require('../middleware/auth');
const lawyerApplicationController = require('../controllers/lawyerApplicationController');

const router = express.Router();

router.get('/applications/me', authenticate(), lawyerApplicationController.getOwnApplication);
router.post('/applications', authenticate(), lawyerApplicationController.submitApplication);
router.patch(
  '/applications/:personaId',
  authenticate(),
  lawyerApplicationController.reviewApplication,
);

module.exports = router;