const express = require('express');
const router = express.Router();
const estudioController = require('../controllers/estudioController');


/**
 * @swagger
 * components:
 *   schemas:
 *     Estudio:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID del estudio
 *         nombre:
 *           type: string
 *           description: Nombre del estudio
 *       example:
 *         id: 1
 *         nombre: Estudio Legal 1
 */

/**
 * @swagger
 * tags:
 *   name: Estudios
 *   description: Gestión de estudios
 */

/**
 * @swagger
 * /estudios:
 *   get:
 *     summary: Busca estudios
 *     tags: [Estudios]
 *     responses:
 *       200:
 *         description: Lista de estudios
 *   post:
 *     summary: Crea un nuevo estudio
 *     tags: [Estudios]
 *     responses:
 *       201:
 *         description: Estudio creado
 */
router.get('/', estudioController.searchEstudios);
router.post('/', estudioController.createEstudio);

module.exports = router;