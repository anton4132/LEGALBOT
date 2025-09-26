const express = require('express');
const { authenticate } = require('../middleware/auth');
const lawyerApplicationController = require('../controllers/lawyerApplicationController');
const {
  searchPublicLawyers,
  listLawyerLocations,
  getPublicLawyerProfile,
  getLawyerAvailabilityWithBookings,
} = require('../controllers/userController');
const router = express.Router();

router.get('/public/search', searchPublicLawyers);
router.get('/public/locations', listLawyerLocations);
router.get('/public/:id/availability', getLawyerAvailabilityWithBookings);
router.get('/public/:id', getPublicLawyerProfile);
/**
 * @swagger
 * /lawyers/applications/me:
 *   get:
 *     tags: [Lawyer Applications]
 *     summary: Obtener mi postulación de abogado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Postulación (o null si no existe)
 *       401:
 *         description: No autenticado
 */

router.get('/applications/me', authenticate(), lawyerApplicationController.getOwnApplication);
/**
 * @swagger
 * /lawyers/applications:
 *   post:
 *     tags: [Lawyer Applications]
 *     summary: Enviar/reenviar datos de postulación
 *     description: Crea o actualiza la postulación. Si estaba OBSERVADA, vuelve a PENDIENTE.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitApplicationRequest'
 *     responses:
 *       201:
 *         description: Creado
 *       200:
 *         description: Actualizado
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       409:
 *         description: Conflicto (en revisión, duplicidad, etc.)
 */



router.post('/applications', authenticate(), lawyerApplicationController.submitApplication);
/**
 * @swagger
 * /lawyers/applications/{personaId}:
 *   patch:
 *     tags: [Lawyer Applications]
 *     summary: Revisar una postulación (admin)
 *     description: Si se APRUEBA, se crea/activa el usuario con rol abogado (solo se duplica la clave).
 *     security:
 *       - BearerAuth: []   # <— OJO: Debe coincidir EXACTO con components.securitySchemes
 *     parameters:
 *       - in: path
 *         name: personaId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 55
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewApplicationRequest'
 *           examples:
 *             aprobar:
 *               summary: Aprobar solicitud
 *               value:
 *                 estado: "APROBADA"
 *             observar:
 *               summary: Observar solicitud
 *               value:
 *                 estado: "OBSERVADA"
 *                 observaciones: "Adjunta el título en mejor calidad"
 *             rechazar:
 *               summary: Rechazar solicitud
 *               value:
 *                 estado: "RECHAZADA"
 *                 observaciones: "Datos no verificables"
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Petición inválida
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Solicitud no encontrada
 *       409:
 *         description: Transición no permitida
 */

router.patch(
  '/applications/:personaId',
  authenticate(),
  lawyerApplicationController.reviewApplication,
);

module.exports = router;