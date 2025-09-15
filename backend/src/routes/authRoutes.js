const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
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
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/start:
 *   post:
 *     summary: Inicia el flujo de autenticación con email (paso 1)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartRequest'
 *     responses:
 *       200:
 *         description: Devuelve cuentas disponibles y un token temporal
 *       400:
 *         description: Falta email
 *       401:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno
 */
router.post('/start', authController.start);

/**
 * @swagger
 * /auth/login-account:
 *   post:
 *     summary: Selecciona cuenta y autentica con contraseña (paso 2)
 *     description: Enviar el token devuelto por /auth/start en la cabecera `Authorization` como `Bearer <token>`.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginAccountRequest'
 *     responses:
 *       200:
 *         description: Devuelve JWT completo para la cuenta
 *       400:
 *         description: Campos faltantes
 *       401:
 *         description: Token inválido/expirado o credenciales incorrectas
 *       500:
 *         description: Error interno
 */
router.post('/login-account', authenticate('select_account'), authController.loginAccount);

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
