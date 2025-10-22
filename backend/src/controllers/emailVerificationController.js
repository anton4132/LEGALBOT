const { prisma } = require('../config/database');
const { sendEmailVerificationCodeEmail } = require('../utils/email');

const CODE_LENGTH = 6;
const DEFAULT_CODE_TTL_MINUTES = 10;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RESEND_WAIT_SECONDS = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const verificationState = new Map();

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const normalizeDigits = (value = '') => String(value || '').replace(/\D/g, '');

const getCodeTtlMinutes = () => {
  const raw = Number(process.env.SIGNUP_EMAIL_CODE_TTL_MINUTES || DEFAULT_CODE_TTL_MINUTES);
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_CODE_TTL_MINUTES;
  }
  return raw;
};

const getMaxAttempts = () => {
  const raw = Number(process.env.SIGNUP_EMAIL_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return raw;
};

const getResendWaitSeconds = () => {
  const raw = Number(process.env.SIGNUP_EMAIL_RESEND_WAIT_SECONDS || DEFAULT_RESEND_WAIT_SECONDS);
  if (Number.isNaN(raw) || raw < 0) {
    return DEFAULT_RESEND_WAIT_SECONDS;
  }
  return raw;
};

const buildKey = (email) => normalizeEmail(email || '');

const getExistingRecord = (email) => {
  const key = buildKey(email);
  if (!key) {
    return null;
  }
  const record = verificationState.get(key);
  if (!record) {
    return null;
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    verificationState.delete(key);
    return null;
  }

  return record;
};

const setRecord = (email, record) => {
  const key = buildKey(email);
  if (!key) {
    return;
  }
  verificationState.set(key, record);
};

const removeRecord = (email) => {
  const key = buildKey(email);
  if (!key) {
    return;
  }
  verificationState.delete(key);
};

const ensureEmailIsAvailable = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return {
      status: 400,
      message: 'Ingresa un correo electrónico válido.',
    };
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return {
      status: 400,
      message: 'Ingresa un correo electrónico válido.',
    };
  }

  const persona = await prisma.persona.findFirst({
    where: { correo: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });

  if (persona) {
    return {
      status: 409,
      message: 'El correo electrónico ya está registrado.',
    };
  }

  return { email: normalizedEmail };
};

const generateCode = () => {
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const validateDeliverability = async (req, res) => {
  try {
    const { correo } = req.body || {};
    const validation = await ensureEmailIsAvailable(correo);

    if (!validation.email) {
      return res
        .status(validation.status || 400)
        .json({ success: false, message: validation.message });
    }

    return res.json({
      success: true,
      message: 'Correo verificado correctamente.',
    });
  } catch (error) {
    console.error('Error validando deliverability de correo:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el correo proporcionado.',
    });
  }
};

const requestCode = async (req, res) => {
  try {
    const { correo } = req.body || {};
    const validation = await ensureEmailIsAvailable(correo);

    if (!validation.email) {
      return res
        .status(validation.status || 400)
        .json({ success: false, message: validation.message });
    }

    const normalizedEmail = validation.email;
    const now = Date.now();
    const existing = getExistingRecord(normalizedEmail);
    const waitSeconds = getResendWaitSeconds();

    if (existing) {
      const elapsedSeconds = Math.floor((now - existing.sentAt.getTime()) / 1000);
      if (waitSeconds > 0 && elapsedSeconds < waitSeconds) {
        const remaining = waitSeconds - elapsedSeconds;
        return res.status(429).json({
          success: false,
          message: `Debes esperar ${remaining} segundos antes de solicitar un nuevo código.`,
        });
      }
    }

    const code = generateCode();
    const minutes = getCodeTtlMinutes();
    const expiration = new Date(now + minutes * 60 * 1000);
    const record = {
      code,
      sentAt: new Date(now),
      expiresAt: expiration,
      attempts: 0,
      verified: false,
    };

    setRecord(normalizedEmail, record);

    await sendEmailVerificationCodeEmail({
      to: normalizedEmail,
      code,
      minutosExpiracion: minutes,
    });

    return res.json({
      success: true,
      message: 'Hemos enviado un código de verificación a tu correo.',
      expiracion: expiration.toISOString(),
    });
  } catch (error) {
    console.error('Error solicitando código de verificación de correo:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo enviar el código de verificación. Inténtalo nuevamente.',
    });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { correo, codigo } = req.body || {};
    const normalizedEmail = normalizeEmail(correo);
    const normalizedCode = normalizeDigits(codigo);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa un correo electrónico válido.',
      });
    }

    if (!normalizedCode || normalizedCode.length !== CODE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Código incorrecto o expirado.',
      });
    }

    const record = getExistingRecord(normalizedEmail);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (record.verified) {
      return res.json({ success: true, message: 'Correo verificado correctamente.' });
    }

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      removeRecord(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    const maxAttempts = getMaxAttempts();
    if (maxAttempts > 0 && record.attempts >= maxAttempts) {
      removeRecord(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (record.code !== normalizedCode) {
      const attempts = record.attempts + 1;
      const updatedRecord = { ...record, attempts };
      if (maxAttempts > 0 && attempts >= maxAttempts) {
        removeRecord(normalizedEmail);
      } else {
        setRecord(normalizedEmail, updatedRecord);
      }

      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    setRecord(normalizedEmail, { ...record, verified: true });

    return res.json({
      success: true,
      message: 'Correo verificado correctamente.',
    });
  } catch (error) {
    console.error('Error verificando código de correo:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el código proporcionado.',
    });
  }
};

module.exports = {
  validateDeliverability,
  requestCode,
  verifyCode,
};