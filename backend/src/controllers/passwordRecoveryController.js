const { prisma } = require('../config/database');
const { sendPasswordRecoveryCodeEmail } = require('../utils/email');

const CODE_LENGTH = 6;
const DEFAULT_CODE_TTL_MINUTES = 5;
const DEFAULT_MAX_ATTEMPTS = 5;
const mismatchMessage = 'Correo y DNI no coinciden. Verifica tus datos.';

const normalizeDigits = (value = '') => String(value).replace(/\D/g, '');
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const getCodeTtlMinutes = () => {
  const raw = Number(process.env.PASSWORD_RECOVERY_CODE_TTL_MINUTES || DEFAULT_CODE_TTL_MINUTES);
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_CODE_TTL_MINUTES;
  }
  return raw;
};

const getMaxAttempts = () => {
  const raw = Number(process.env.PASSWORD_RECOVERY_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return raw;
};

const buildFullName = (persona) =>
  [
    persona?.primer_nombre,
    persona?.segundo_nombre,
    persona?.apellido_paterno,
    persona?.apellido_materno,
  ]
    .map((part) => (part || '').trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .trim();

const findPersonaAndActiveUser = async (dni, correo) => {
  const sanitizedDni = normalizeDigits(dni);
  const sanitizedEmail = normalizeEmail(correo);

  if (!sanitizedDni || sanitizedDni.length !== 8) {
    return {
      error: { status: 400, message: 'Debes ingresar un DNI válido de 8 dígitos.' },
    };
  }

  if (!sanitizedEmail) {
    return {
      error: { status: 400, message: 'Debes ingresar un correo electrónico válido.' },
    };
  }

  const persona = await prisma.persona.findUnique({
    where: { dni: sanitizedDni },
    include: {
      usuario: {
        where: { activo: true },
        orderBy: { creado_el: 'asc' },
      },
    },
  });

  if (!persona) {
    return { error: { status: 404, message: mismatchMessage } };
  }

  if (normalizeEmail(persona.correo) !== sanitizedEmail) {
    return { error: { status: 404, message: mismatchMessage } };
  }

  const activeUser = Array.isArray(persona.usuario) ? persona.usuario[0] : null;
  if (!activeUser) {
    return {
      error: {
        status: 403,
        message: 'El usuario no está habilitado para recuperación.',
      },
    };
  }

  return { persona, usuario: activeUser, dni: sanitizedDni, correo: sanitizedEmail };
};

const validateIdentity = async (req, res) => {
  try {
    const { dni, correo } = req.body || {};
    const result = await findPersonaAndActiveUser(dni, correo);

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ success: false, message: result.error.message });
    }

    return res.json({
      success: true,
      message: 'Identidad validada correctamente.',
    });
  } catch (error) {
    console.error('Error validando identidad para recuperación:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo validar la identidad. Inténtalo nuevamente.',
    });
  }
};

const generateRecoveryCode = () => {
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const requestCode = async (req, res) => {
  try {
    const { dni, correo } = req.body || {};
    const result = await findPersonaAndActiveUser(dni, correo);

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ success: false, message: result.error.message });
    }

    const { persona, usuario } = result;
    const code = generateRecoveryCode();
    const minutes = getCodeTtlMinutes();
    const expiration = new Date(Date.now() + minutes * 60 * 1000);

    const recovery = await prisma.$transaction(async (tx) => {
      await tx.recuperacionclave.updateMany({
        where: {
          persona_id: persona.id,
          estado: { in: ['PENDIENTE', 'VERIFICADO'] },
        },
        data: { estado: 'EXPIRADO' },
      });

      return tx.recuperacionclave.create({
        data: {
          persona_id: persona.id,
          usuario_id: usuario.id,
          codigo: code,
          expiracion: expiration,
        },
      });
    });

    await sendPasswordRecoveryCodeEmail({
      to: persona.correo,
      code,
      nombre: buildFullName(persona),
      minutosExpiracion: minutes,
    });

    return res.json({
      success: true,
      message: 'Te hemos enviado un código de verificación al correo registrado.',
      expiracion: recovery.expiracion,
    });
  } catch (error) {
    console.error('Error generando código de recuperación:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo generar el código de recuperación. Inténtalo nuevamente.',
    });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { dni, correo, codigo } = req.body || {};
    const result = await findPersonaAndActiveUser(dni, correo);

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ success: false, message: result.error.message });
    }

    const normalizedCode = normalizeDigits(codigo);
    if (!normalizedCode || normalizedCode.length !== CODE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Código incorrecto o expirado.',
      });
    }

    const { persona, usuario } = result;
    const now = new Date();
    const maxAttempts = getMaxAttempts();

    const latest = await prisma.recuperacionclave.findFirst({
      where: {
        persona_id: persona.id,
        usuario_id: usuario.id,
        estado: { in: ['PENDIENTE', 'VERIFICADO'] },
      },
      orderBy: { creado_el: 'desc' },
    });

    if (!latest) {
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (latest.expiracion < now) {
      await prisma.recuperacionclave.update({
        where: { id: latest.id },
        data: { estado: 'EXPIRADO' },
      });
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (latest.estado === 'VERIFICADO' && latest.codigo === normalizedCode) {
      return res.json({
        success: true,
        message: 'Código verificado correctamente.',
      });
    }

    if (latest.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (latest.intentos >= maxAttempts) {
      await prisma.recuperacionclave.update({
        where: { id: latest.id },
        data: { estado: 'EXPIRADO' },
      });
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (latest.codigo !== normalizedCode) {
      const updated = await prisma.recuperacionclave.update({
        where: { id: latest.id },
        data: { intentos: { increment: 1 } },
      });

      if (updated.intentos >= maxAttempts) {
        await prisma.recuperacionclave.update({
          where: { id: updated.id },
          data: { estado: 'EXPIRADO' },
        });
      }

      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    await prisma.recuperacionclave.update({
      where: { id: latest.id },
      data: { estado: 'VERIFICADO' },
    });

    return res.json({
      success: true,
      message: 'Código verificado correctamente.',
    });
  } catch (error) {
    console.error('Error verificando código de recuperación:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el código. Inténtalo nuevamente.',
    });
  }
};

const isPasswordStrong = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(trimmed);
  const hasNumber = /\d/.test(trimmed);
  return hasLetter && hasNumber;
};

const resetPassword = async (req, res) => {
  try {
    const { dni, correo, codigo, nuevaClave } = req.body || {};
    const result = await findPersonaAndActiveUser(dni, correo);

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ success: false, message: result.error.message });
    }

    const normalizedCode = normalizeDigits(codigo);
    if (!normalizedCode || normalizedCode.length !== CODE_LENGTH) {
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (!isPasswordStrong(nuevaClave)) {
      return res.status(400).json({
        success: false,
        message:
          'La nueva contraseña debe tener al menos 8 caracteres, incluir letras y números.',
      });
    }

    const { persona, usuario } = result;
    const now = new Date();

    const recovery = await prisma.recuperacionclave.findFirst({
      where: {
        persona_id: persona.id,
        usuario_id: usuario.id,
        codigo: normalizedCode,
        estado: 'VERIFICADO',
      },
      orderBy: { creado_el: 'desc' },
    });

    if (!recovery) {
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    if (recovery.expiracion < now) {
      await prisma.recuperacionclave.update({
        where: { id: recovery.id },
        data: { estado: 'EXPIRADO' },
      });
      return res.status(400).json({ success: false, message: 'Código incorrecto o expirado.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: { clave: String(nuevaClave).trim() },
      });

      await tx.recuperacionclave.update({
        where: { id: recovery.id },
        data: { estado: 'COMPLETADO' },
      });

      await tx.recuperacionclave.updateMany({
        where: {
          persona_id: persona.id,
          id: { not: recovery.id },
          estado: { in: ['PENDIENTE', 'VERIFICADO'] },
        },
        data: { estado: 'EXPIRADO' },
      });
    });

    return res.json({
      success: true,
      message: 'Tu contraseña ha sido actualizada correctamente.',
    });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo actualizar la contraseña. Inténtalo nuevamente.',
    });
  }
};

module.exports = {
  validateIdentity,
  requestCode,
  verifyCode,
  resetPassword,
};