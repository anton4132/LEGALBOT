const { prisma } = require('../config/database');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Login directo para compatibilidad con frontend existente
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y password son requeridos' });
    }

    const persona = await prisma.persona.findFirst({
      where: { correo: email },
      include: { usuario: { include: { role: true } } }
    });

    if (!persona) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const user = (persona.usuario || []).find(u => u.clave === password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    // 🔐 Emite JWT para Swagger / endpoints protegidos
    const token = jwt.sign(
      {
        personaId: persona.id,
        usuarioId: user.id,
        rolId: user.rol_id,
        scope: 'full',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      token, // <= IMPORTANTE
      user: {
        id: user.id,
        email: persona.correo,
        nombre: `${persona.primer_nombre} ${persona.apellido_paterno}`.trim(),
        rolCodigo: user.role?.codigo || null,
        rolNombre: user.role?.nombre || null,
        activo: user.activo,
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};


// Cambiar de cuenta sin reautenticar (misma persona)
const switchAccount = async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const personaId = req.ctx.personaId;

    if (!usuarioId) {
      return res.status(400).json({ message: 'usuarioId es requerido' });
    }

    const targetAccount = await prisma.usuario.findFirst({
      where: { id: usuarioId, persona_id: personaId },
      include: { role: true }
    });

    if (!targetAccount) {
      return res.status(403).json({ message: 'Cuenta no pertenece a la persona' });
    }


    const currentAccount = await prisma.usuario.findUnique({
      where: { id: req.ctx.usuarioId },
      include: { role: true }
    });

    const currentRoleCode = (currentAccount?.role?.codigo || '').toLowerCase();
    const targetRoleCode = (targetAccount.role?.codigo || '').toLowerCase();

    const ensureVerification = async () =>
      prisma.verificacionabogado.findUnique({
        where: { persona_id: personaId }
      });

    if (targetRoleCode === 'abogado') {
      if (currentRoleCode !== 'cliente') {
        return res.status(403).json({
          message:
            'Solo puedes acceder al panel de abogado desde tu cuenta de cliente.',
          code: 'LAWYER_SWITCH_FORBIDDEN'
        });
      }

      const verification = await ensureVerification();
      const verificationState = (verification?.estado || '').toUpperCase();

      if (!targetAccount.activo) {
        const reason = (verification?.observaciones || '').trim();
        return res.status(423).json({
          message:
            reason ||
            'Tu cuenta de abogado está deshabilitada hasta que regularices tu información.',
          state: verificationState || null,
          code: 'LAWYER_ACCOUNT_DISABLED'
        });
      }

      if (verificationState !== 'APROBADA') {
        let message = 'Tu postulación aún no ha sido aprobada.';
        if (verificationState === 'PENDIENTE') {
          message =
            'Estamos revisando tu postulación. Podrás acceder al panel de abogado cuando sea aprobada.';
        } else if (verificationState === 'OBSERVADA') {
          const detail = (verification?.observaciones || '').trim();
          message =
            detail ||
            'Tu postulación fue observada. Corrige la información solicitada para continuar.';
        } else if (verificationState === 'RECHAZADA') {
          const detail = (verification?.observaciones || '').trim();
          message =
            detail ||
            'Tu postulación fue rechazada. Contáctanos para más información.';
        }

        return res.status(409).json({
          message,
          state: verificationState || null,
          code: 'LAWYER_VERIFICATION_BLOCKED'
        });
      }
    }

    if (!targetAccount.activo) {
      return res.status(423).json({
        message: 'La cuenta seleccionada está deshabilitada.',
        code: 'ACCOUNT_DISABLED'
      });
    }
    const token = jwt.sign(
      {
        personaId: targetAccount.persona_id,
        usuarioId: targetAccount.id,
        rolId: targetAccount.rol_id,
        scope: 'full'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      personaId: targetAccount.persona_id,
      usuarioId: targetAccount.id,
      rolId: targetAccount.rol_id,
      rolCodigo: targetAccount.role?.codigo || null,
      rolNombre: targetAccount.role?.nombre || null,
      activo: targetAccount.activo,
    });
  } catch (error) {
    console.error('Error en switchAccount:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  switchAccount
};