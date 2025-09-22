const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const mobileAuthController = require('../controllers/mobileAuthController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints de autenticación
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           example: anton@gmail.com
 *         password:
 *           type: string
 *           example: tUE5$pgj3-ZyhH~
 *     StartRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: anton@gmail.com
 *     LoginAccountRequest:
 *       type: object
 *       required: [usuarioId, password]
 *       properties:
 *         usuarioId:
 *           type: integer
 *           example: 7
 *         password:
 *           type: string
 *           example: tUE5$pgj3-ZyhH~
 *     SwitchAccountRequest:
 *       type: object
 *       required: [usuarioId]
 *       properties:
 *         usuarioId:
 *           type: integer
 *           example: 51
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Credenciales incorrectas
 */
router.post('/login', authController.login);
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login directo con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Autenticación exitosa
 *       400:
 *         description: Faltan credenciales
 *       401:
 *         description: Credenciales incorrectas
 *       500:
 *         description: Error interno
 */

router.post('/mobile-login', mobileAuthController.loginFlutter);


/**
 * @swagger
 * /auth/switch-account:
 *   post:
 *     summary: Cambia la cuenta activa de la misma persona
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwitchAccountRequest'
 *     responses:
 *       200:
 *         description: Devuelve nuevo JWT con la cuenta cambiada
 *       400:
 *         description: Campos faltantes
 *       403:
 *         description: Cuenta no pertenece a la persona
 *       500:
 *         description: Error interno
 */
router.post('/switch-account', authenticate(), authController.switchAccount);

module.exports = router;
