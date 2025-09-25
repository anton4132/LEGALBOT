const { prisma } = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const normalizeDigits = (value = '') => String(value).replace(/\D/g, '');

const buildFullName = (persona) =>
  [
    persona.primer_nombre,
    persona.segundo_nombre,
    persona.apellido_paterno,
    persona.apellido_materno,
  ]
    .map((part) => (part || '').trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .trim();

const mapVerification = (record) => {
  if (!record) return null;
  return {
    id: record.id,
    personaId: record.persona_id,
    estado: record.estado,
    linkedinUrl: record.linkedin_url,
    tituloUrl: record.titulo_url,
    observaciones: record.observaciones,
    aprobadoEl: record.aprobado_el,
    creadoEl: record.creado_el,
    actualizadoEl: record.actualizado_el,
  };
};

const loginFlutter = async (req, res) => {
  try {
    const { telefono, dni, password } = req.body || {};

    if (!telefono || !dni || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'telefono, dni y password son requeridos' });
    }

    const sanitizedPhone = normalizeDigits(telefono);
    const sanitizedDni = normalizeDigits(dni);
    if (!sanitizedPhone || !sanitizedDni) {
      return res
        .status(400)
        .json({ success: false, message: 'Credenciales inválidas' });
    }

    if (sanitizedDni.length !== 8) {
      return res.status(400).json({ success: false, message: 'DNI inválido' });
    }

    if (sanitizedPhone.length < 6) {
      return res.status(400).json({ success: false, message: 'Teléfono inválido' });
    }

    const persona = await prisma.persona.findUnique({
      where: { dni: sanitizedDni },
      include: {
        usuario: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!persona) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const storedPhone = normalizeDigits(persona.telefono || '');
    const phoneMatches =
      storedPhone === sanitizedPhone ||
      (storedPhone.length > sanitizedPhone.length &&
        storedPhone.endsWith(sanitizedPhone));
    if (!storedPhone || !phoneMatches) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const passwordValue = String(password).trim();
    
    const cuentas = Array.isArray(persona.usuario) ? persona.usuario : [];

    if (cuentas.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const matchingAccounts = cuentas.filter((u) => u.clave === passwordValue);

    if (matchingAccounts.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const preferredAccount =
      matchingAccounts.find((u) => (u.role?.codigo || '').toLowerCase() === 'cliente') ||
      matchingAccounts[0];

    const nombreCompleto = buildFullName(persona);

    const token = jwt.sign(
      {
        personaId: persona.id,
        usuarioId: preferredAccount.id,
        rolId: preferredAccount.rol_id,
        scope: 'full',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const verification = await prisma.verificacionabogado.findUnique({
      where: { persona_id: persona.id },
    });

    return res.json({
      success: true,
      token,
      user: {
        personaId: persona.id,
        usuarioId: preferredAccount.id,
        rolId: preferredAccount.rol_id,
        rolCodigo: preferredAccount.role?.codigo || null,
        rolNombre: preferredAccount.role?.nombre || null,
        activo: preferredAccount.activo,
        telefono: persona.telefono,
        dni: persona.dni,
        correo: persona.correo,
        nombreCompleto,
      },
      accounts: matchingAccounts.map((u) => ({
        usuarioId: u.id,
        rolId: u.rol_id,
        rolCodigo: u.role?.codigo || null,
        rolNombre: u.role?.nombre || null,
        activo: u.activo,
      })),
      verification: mapVerification(verification),
    });
  } catch (error) {
    console.error('Error en login móvil:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
const getMyAccounts = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        usuario: {
          include: { role: true },
        },
      },
    });

    if (!persona) {
      return res.status(404).json({ message: 'Persona no encontrada' });
    }

    const accounts = (persona.usuario || []).map((u) => ({
      usuarioId: u.id,
      rolId: u.rol_id,
      rolCodigo: u.role?.codigo || null,
      rolNombre: u.role?.nombre || null,
      activo: u.activo,
    }));

    res.json({
      personaId: persona.id,
      telefono: persona.telefono,
      dni: persona.dni,
      correo: persona.correo,
      nombreCompleto: buildFullName(persona),
      accounts,
    });
  } catch (error) {
    console.error('Error obteniendo cuentas móviles:', error);
    res.status(500).json({ message: 'Error obteniendo cuentas' });
  }
};

module.exports = { loginFlutter, getMyAccounts };