const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Flujos de autenticación
router.post('/login', authController.login);
router.post('/start', authController.start);
router.post('/login-account', authenticate('select_account'), authController.loginAccount);
router.post('/switch-account', authenticate(), authController.switchAccount);

module.exports = router;