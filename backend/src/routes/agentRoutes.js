const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/agentController');
/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: Endpoint para conversar con LegalBot y realizar clasificación + retrieval.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LegalbotChatRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: Mensaje o pregunta del usuario.
 *           example: "Necesito ayuda con un contrato laboral"
 *         threadId:
 *           type: string
 *           nullable: true
 *           description: Identificador opcional para reutilizar el hilo de conversación.
 *           example: "cliente-123"
 *     LegalbotContextDoc:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           nullable: true
 *         text:
 *           type: string
 *         source:
 *           type: string
 *           nullable: true
 *         score:
 *           type: number
 *           nullable: true
 *     LegalbotChatResponse:
 *       type: object
 *       properties:
 *         reply:
 *           type: string
 *           description: Respuesta generada por el agente.
 *         contextDocs:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LegalbotContextDoc'
 *         classifiedSpecialty:
 *           type: object
 *           nullable: true
 *           description: Resultado de la clasificación interna del caso.
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *         threadId:
 *           type: string
 *           nullable: true
 */

function validatePayload(req, res, next) {
  const { message, threadId } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: "El campo 'message' es obligatorio y debe ser un string no vacío.",
    });
  }

  if (threadId !== undefined && typeof threadId !== 'string') {
    return res.status(400).json({
      error: "El campo opcional 'threadId' debe ser un string.",
    });
  }

  req.body.message = message.trim();
  next();
}

/**
 * @swagger
 * /agent/chat:
 *   post:
 *     tags: [Agent]
 *     summary: Envía un mensaje al agente LegalBot para clasificación y respuesta.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LegalbotChatRequest'
 *     responses:
 *       200:
 *         description: Respuesta generada con el contexto recuperado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LegalbotChatResponse'
 *       400:
 *         description: Payload inválido (falta message o tipos incorrectos).
 *       500:
 *         description: Error interno procesando la solicitud.
 */
router.post('/chat', validatePayload, sendMessage);

module.exports = router;