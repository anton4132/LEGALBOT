const express = require('express');
const router = express.Router();
const estudioController = require('../controllers/estudioController');


/**
 * @swagger
 * tags:
 *   name: Estudios
 *   description: Gestión de estudios (bufetes / firmas)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Estudio:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *         ruc:
 *           type: string
 *           nullable: true
 *           example: "20601234567"
 *         nombre_comercial:
 *           type: string
 *           nullable: true
 *           example: "Estudio Legal Rivera"
 *         pais:
 *           type: string
 *           nullable: true
 *           example: "Perú"
 *         ciudad:
 *           type: string
 *           nullable: true
 *           example: "Lima"
 *         correo_contacto:
 *           type: string
 *           nullable: true
 *           example: "contacto@riveralegal.pe"
 *         telefono:
 *           type: string
 *           nullable: true
 *           example: "+51 1 555-1234"
 *         direccion:
 *           type: string
 *           nullable: true
 *           example: "Av. Principal 123, Miraflores"
 *         activo:
 *           type: boolean
 *           example: false
 *         creado_el:
 *           type: string
 *           format: date-time
 *           example: "2025-09-15T12:34:56.000Z"
 *         actualizado_el:
 *           type: string
 *           format: date-time
 *           example: "2025-09-15T12:34:56.000Z"
 *
 *     EstudioCreateRequest:
 *       type: object
 *       properties:
 *         ruc:
 *           type: string
 *           description: RUC único (opcional, pero si se envía debe ser único)
 *           example: "20601234567"
 *         nombre_comercial:
 *           type: string
 *           example: "Estudio Legal Rivera"
 *         pais:
 *           type: string
 *           example: "Perú"
 *         ciudad:
 *           type: string
 *           example: "Lima"
 *         correo_contacto:
 *           type: string
 *           example: "contacto@riveralegal.pe"
 *         telefono:
 *           type: string
 *           example: "+51 1 555-1234"
 *         direccion:
 *           type: string
 *           example: "Av. Principal 123, Miraflores"
 *       example:
 *         ruc: "20601234567"
 *         nombre_comercial: "Estudio Legal Rivera"
 *         pais: "Perú"
 *         ciudad: "Lima"
 *         correo_contacto: "contacto@riveralegal.pe"
 *         telefono: "+51 1 555-1234"
 *         direccion: "Av. Principal 123, Miraflores"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *       examples:
 *         serverError:
 *           value:
 *             message: "Error interno del servidor"
 *         duplicateRuc:
 *           value:
 *             message: "El RUC ya está registrado"
 */

/**
 * @swagger
 * /estudios:
 *   get:
 *     summary: Busca estudios por RUC o nombre comercial
 *     description: >
 *       Devuelve hasta 10 resultados ordenados por `nombre_comercial` ascendente.
 *       Si no se envía el parámetro `search`, devuelve un arreglo vacío.
 *     tags: [Estudios]
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Término a buscar (RUC o parte del nombre comercial)
 *         example: "Rivera"
 *     responses:
 *       200:
 *         description: Lista de estudios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Estudio'
 *             examples:
 *               ok:
 *                 value:
 *                   - id: 12
 *                     ruc: "20601234567"
 *                     nombre_comercial: "Estudio Legal Rivera"
 *                     pais: "Perú"
 *                     ciudad: "Lima"
 *                     correo_contacto: "contacto@riveralegal.pe"
 *                     telefono: "+51 1 555-1234"
 *                     direccion: "Av. Principal 123, Miraflores"
 *                     activo: true
 *       500:
 *         description: Error buscando estudios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 $ref: '#/components/schemas/ErrorResponse/examples/serverError'
 */
router.get('/', estudioController.searchEstudios);
/**
 * @swagger
 * /estudios:
 *   post:
 *     summary: Crea un nuevo estudio
 *     description: >
 *       Crea un estudio y lo marca como `activo: true`.  
 *       Si se envía `ruc` y ya existe en la base de datos, devuelve **409**.
 *     tags: [Estudios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EstudioCreateRequest'
 *     responses:
 *       201:
 *         description: Estudio creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Estudio'
 *       409:
 *         description: RUC duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               duplicateRuc:
 *                 $ref: '#/components/schemas/ErrorResponse/examples/duplicateRuc'
 *       500:
 *         description: Error creando estudio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               serverError:
 *                 $ref: '#/components/schemas/ErrorResponse/examples/serverError'
 */
router.post('/', estudioController.createEstudio);

module.exports = router;