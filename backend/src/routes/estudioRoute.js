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
 *         ruc:
 *           type: string
 *           nullable: true
 *         nombre_comercial:
 *           type: string
 *           nullable: true
 *         pais:
 *           type: string
 *           nullable: true
 *         ciudad:
 *           type: string
 *           nullable: true
 *         correo_contacto:
 *           type: string
 *           nullable: true
 *         telefono:
 *           type: string
 *           nullable: true
 *         direccion:
 *           type: string
 *           nullable: true
 *         activo:
 *           type: boolean
 *         creado_el:
 *           type: string
 *           format: date-time
 *         actualizado_el:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 12
 *         ruc: "20601234567"
 *         nombre_comercial: "Estudio Legal Rivera"
 *         pais: "Perú"
 *         ciudad: "Lima"
 *         correo_contacto: "contacto@riveralegal.pe"
 *         telefono: "+51 1 555-1234"
 *         direccion: "Av. Principal 123, Miraflores"
 *         activo: true
 *         creado_el: "2025-09-15T12:34:56.000Z"
 *         actualizado_el: "2025-09-16T09:12:34.000Z"
 *
 *     EstudioCreateRequest:
 *       type: object
 *       properties:
 *         ruc:
 *           type: string
 *           description: RUC único (opcional, pero si se envía debe ser único)
 *         nombre_comercial:
 *           type: string
 *         pais:
 *           type: string
 *         ciudad:
 *           type: string
 *         correo_contacto:
 *           type: string
 *         telefono:
 *           type: string
 *         direccion:
 *           type: string
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
 *       example:
 *         message: "Error interno del servidor"
 *
 *     ApiPeruRucResponse:
 *       type: object
 *       description: Respuesta cruda enviada por el servicio externo https://apiperu.dev/api/ruc.
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             ruc:
 *               type: string
 *               example: "20100443688"
 *             nombre_o_razon_social:
 *               type: string
 *               example: "EMPRESA DE PRUEBA S.A.C."
 *             ubigeo_sunat:
 *               type: string
 *               example: "1501"
 *             departamento:
 *               type: string
 *               example: "LIMA"
 *             provincia:
 *               type: string
 *               example: "LIMA"
 *             distrito:
 *               type: string
 *               nullable: true
 *               example: null
 *             direccion_completa:
 *               type: string
 *               example: "AV. PRINCIPAL 123"
 *       example:
 *         success: true
 *         data:
 *           ruc: "20100443688"
 *           nombre_o_razon_social: "EMPRESA DE PRUEBA S.A.C."
 *           ubigeo_sunat: "1501"
 *           departamento: "LIMA"
 *           provincia: "LIMA"
 *           distrito: null
 *           direccion_completa: "AV. PRINCIPAL 123"
 *     EstudioConsultaRucResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Estudio'
 *       example:
 *         success: true
 *         data:
 *           id: 42
 *           ruc: "20100443688"
 *           nombre_comercial: "EMPRESA DE PRUEBA S.A.C."
 *           direccion_ubigeo_codigo: "150100"
 *           linea_exacta_direccion: "AV. PRINCIPAL 123"
 *           departamento: "LIMA"
 *           provincia: "LIMA"
 *           distrito: "Sin distrito"
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
 *                 value:
 *                   message: "El RUC ya está registrado"
 *       500:
 *         description: Error creando estudio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', estudioController.createEstudio);

/**
 * @swagger
 * /estudios/consulta-ruc:
 *   post:
 *     summary: Consulta y registra un estudio por RUC (APIPERU)
 *     description: >
 *       Consulta el servicio externo de https://apiperu.dev/api/ruc para obtener los datos de un RUC,
 *       crea/actualiza el estudio y asegura que exista la dirección correspondiente. Cuando el ubigeo
 *       devuelto tiene solo 4 dígitos (sin distrito), se completa automáticamente con "00" para mantener
 *       el formato estándar de 6 dígitos.
 *     tags: [Estudios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruc:
 *                 type: string
 *                 example: "20100443688"
 *     responses:
 *       200:
 *         description: Estudio registrado/actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstudioConsultaRucResponse'
 *       400:
 *         description: Error de validación en el RUC o en la respuesta del servicio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidUbigeo:
 *                 value:
 *                   message: "El servicio de RUC no devolvió un código de ubigeo válido (6 dígitos)."
 *               missingDireccion:
 *                 value:
 *                   message: "El servicio de RUC no devolvió una dirección completa para registrar."
 *               noDireccionValida:
 *                 value:
 *                   message: "Este RUC no tiene una dirección válida."
 *       500:
 *         description: Error consultando el servicio o registrando el estudio
 */
router.post('/consulta-ruc', estudioController.lookupEstudioPorRuc);

module.exports = router;