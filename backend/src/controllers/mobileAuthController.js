const { prisma } = require('../config/database');

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
          include: { role: true },
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
    const matchingAccounts = persona.usuario.filter((u) => u.clave === passwordValue);

    if (matchingAccounts.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const preferredAccount =
      matchingAccounts.find((u) => (u.role?.codigo || '').toLowerCase() === 'cliente') ||
      matchingAccounts[0];

    const nombreCompleto = buildFullName(persona);

    return res.json({
      success: true,
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
    });
  } catch (error) {
    console.error('Error en login móvil:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { loginFlutter };