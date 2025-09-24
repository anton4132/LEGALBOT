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

    const user = await prisma.usuario.findFirst({
      where: { id: usuarioId, persona_id: personaId },
      include: { role: true }
    });

    if (!user) {
      return res.status(403).json({ message: 'Cuenta no pertenece a la persona' });
    }

    const token = jwt.sign(
      {
        personaId: user.persona_id,
        usuarioId: user.id,
        rolId: user.rol_id,
        scope: 'full'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      personaId: user.persona_id,
      usuarioId: user.id,
      rolId: user.rol_id,
      rolCodigo: user.role?.codigo || null,
      rolNombre: user.role?.nombre || null,
      activo: user.activo,
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