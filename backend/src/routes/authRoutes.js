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


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login directo con email y contraseña (devuelve JWT)
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 token:   { type: string, example: "eyJhbGciOi..." }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:        { type: integer, example: 12 }
 *                     email:     { type: string, example: "admin@acme.com" }
 *                     nombre:    { type: string,  example: "Admin Root" }
 *                     rolCodigo: { type: string,  example: "admin" }
 *                     rolNombre: { type: string,  example: "Administrador" }
 *                     activo:    { type: boolean, example: true }
 *       400: { description: Faltan credenciales }
 *       401: { description: Credenciales incorrectas }
 *       500: { description: Error interno }
 */

router.post('/login', authController.login);

/**
 * @swagger
 * /auth/mobile-login:
 *   post:
 *     tags: [Auth]
 *     summary: Login móvil (DNI + teléfono + password)
 *     description: >
 *       Inicia sesión para la app móvil validando **DNI**, **teléfono** y **password**.  
 *       Devuelve un **JWT** (1h), la **cuenta preferida** (prioriza rol cliente),  
 *       la lista de **cuentas coincidentes** por contraseña (para alternar rol) y el
 *       **estado de verificación** de abogado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MobileLoginRequest'
 *           examples:
 *             ejemplo:
 *               summary: Ejemplo válido
 *               value:
 *                 telefono: "916036345"
 *                 dni: "75820859"
 *                 password: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileLoginResponse'
 *       400:
 *         description: Petición inválida (faltan campos o formato incorrecto)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileErrorResponse'
 *       401:
 *         description: Credenciales incorrectas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileErrorResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileErrorResponse'
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


/**
 * @swagger
 * /auth/mobile-accounts:
 *   get:
 *     summary: Lista las cuentas disponibles para la persona autenticada
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cuentas asociadas a la persona
 *       401:
 *         description: No autenticado
 */
router.get('/mobile-accounts', authenticate(), mobileAuthController.getMyAccounts);

module.exports = router;
