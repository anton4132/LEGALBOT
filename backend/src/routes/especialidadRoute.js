// routes/especialidadRoutes.js
const express = require('express');
const router = express.Router();
const especialidadController = require('../controllers/especialidadController');


/**
 * @swagger
 * components:
 *   schemas:
 *     Especialidad:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID de la especialidad
 *         nombre:
 *           type: string
 *           description: Nombre de la especialidad
 *       example:
 *         id: 1
 *         nombre: Derecho Civil
 */

/**
 * @swagger
 * tags:
 *   name: Especialidades
 *   description: Gestión de especialidades
 */

/**
 * @swagger
 * /especialidades:
 *   get:
 *     summary: Lista todas las especialidades
 *     tags: [Especialidades]
 *     responses:
 *       200:
 *         description: Lista de especialidades
 */
router.get('/', especialidadController.getAllEspecialidades);

module.exports = router;
