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
      include: { usuario: true }
    });

    if (!persona) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const user = persona.usuario.find(u => u.clave === password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: persona.correo,
        nombre: `${persona.primer_nombre} ${persona.apellido_paterno}`.trim()
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};




// Paso 1: iniciar login con correo y devolver cuentas disponibles
const start = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email es requerido' });
    }

    const persona = await prisma.persona.findFirst({
      where: { correo: email },
      include: {
        usuario: {
          include: { role: true }
        }
      }
    });

    if (!persona) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const cuentas = persona.usuario.map(u => ({
      usuarioId: u.id,
      rolId: u.rol_id,
      rolNombre: u.role.nombre,
      activo: u.activo,
      requiere2FA: false
    }));

    const token = jwt.sign(
      { personaId: persona.id, scope: 'select_account' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.json({ personaId: persona.id, cuentas, token });
  } catch (error) {
    console.error('Error en start:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Paso 2: elegir cuenta y autenticar con contraseña
const loginAccount = async (req, res) => {
  try {
    const { usuarioId, password } = req.body;
    const personaId = req.ctx.personaId;

    if (!usuarioId || !password) {
      return res.status(400).json({ message: 'usuarioId y password son requeridos' });
    }

    const user = await prisma.usuario.findFirst({
      where: { id: usuarioId, persona_id: personaId },
      include: { role: true }
    });

    if (!user || user.clave !== password) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
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
    console.error('Error en loginAccount:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
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
  start,
  loginAccount,
  switchAccount
};