const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/agentController');

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

router.post('/chat', validatePayload, sendMessage);

module.exports = router;
