const { EstadoVerificacion } = require('@prisma/client');
const { prisma } = require('../config/database');


//limpia strings (trim). Si no es string, devuelve ''.
const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');


//verifica que la URL sea http/https usando new URL(...).
const isValidUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

//mapApplication(row): normaliza el objeto verificacionabogado a un JSON limpio para responder.
const mapApplication = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    personaId: row.persona_id,
    estado: row.estado,
    linkedinUrl: row.linkedin_url,
    tituloUrl: row.titulo_url,
    observaciones: row.observaciones,
    aprobadoEl: row.aprobado_el,
    creadoEl: row.creado_el,
    actualizadoEl: row.actualizado_el,
  };
};

//ensureAdmin(rolId): verifica si el rol es admin o superadmin.
const ensureAdmin = async (rolId) => {
  if (!rolId) return false;
  const role = await prisma.role.findUnique({ where: { id: rolId } });
  const code = (role?.codigo || '').toLowerCase();
  return code === 'admin' || code === 'superadmin';
};

//ensureLawyerAccount(tx, personaId): verifica si la persona tiene una cuenta de abogado activa.
const ensureLawyerAccount = async (tx, personaId) => {
  const role = await tx.role.findFirst({ where: { codigo: 'abogado' } });
  if (!role) {
    return null;
  }

  let lawyerAccount = await tx.usuario.findFirst({
    where: { persona_id: personaId, rol_id: role.id },
  });

  if (lawyerAccount) {
    if (!lawyerAccount.activo) {
      lawyerAccount = await tx.usuario.update({
        where: { id: lawyerAccount.id },
        data: { activo: true },
      });
    }
    return lawyerAccount;
  }

  const baseAccount = await tx.usuario.findFirst({
    where: { persona_id: personaId },
    orderBy: { id: 'asc' },
  });

  if (!baseAccount) {
    throw new Error('La persona no cuenta con una cuenta base para generar el rol de abogado');
  }

  lawyerAccount = await tx.usuario.create({
    data: {
      persona_id: personaId,
      rol_id: role.id,
      clave: baseAccount.clave,
      activo: true,
    },
  });

  return lawyerAccount;
};

const getOwnApplication = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const application = await prisma.verificacionabogado.findUnique({
      where: { persona_id: personaId },
    });

    return res.json({ success: true, application: mapApplication(application) });
  } catch (error) {
    console.error('Error obteniendo verificación de abogado:', error);
    return res.status(500).json({ success: false, message: 'Error obteniendo verificación' });
  }
};

const submitApplication = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const linkedinUrl = sanitizeString(req.body?.linkedinUrl);
    const tituloUrl = sanitizeString(req.body?.tituloUrl);

    if (!isValidUrl(linkedinUrl) || !isValidUrl(tituloUrl)) {
      return res.status(400).json({
        success: false,
        message: 'linkedinUrl y tituloUrl deben ser URLs válidas (http/https)',
      });
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
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    const hasActiveLawyerRole = (persona.usuario || []).some(
      (u) => (u.role?.codigo || '').toLowerCase() === 'abogado' && u.activo,
    );

    if (hasActiveLawyerRole) {
      return res.status(409).json({
        success: false,
        message: 'Ya cuentas con un perfil de abogado activo',
      });
    }

    const existing = await prisma.verificacionabogado.findUnique({
      where: { persona_id: personaId },
    });

    if (!existing) {
      const created = await prisma.verificacionabogado.create({
        data: {
          persona_id: personaId,
          linkedin_url: linkedinUrl,
          titulo_url: tituloUrl,
          estado: EstadoVerificacion.PENDIENTE,
          observaciones: null,
          aprobado_el: null,
        },
      });

      return res.status(201).json({ success: true, application: mapApplication(created) });
    }

    if (existing.estado === EstadoVerificacion.PENDIENTE) {
      return res.status(409).json({
        success: false,
        message: 'Tu solicitud ya está en revisión',
      });
    }

    if (existing.estado === EstadoVerificacion.APROBADA) {
      return res.status(409).json({
        success: false,
        message: 'Tu solicitud ya fue aprobada',
      });
    }

    if (existing.estado === EstadoVerificacion.RECHAZADA) {
      return res.status(409).json({
        success: false,
        message: 'Tu solicitud fue rechazada. Comunícate con soporte para más información',
      });
    }

    const updated = await prisma.verificacionabogado.update({
      where: { persona_id: personaId },
      data: {
        linkedin_url: linkedinUrl,
        titulo_url: tituloUrl,
        estado: EstadoVerificacion.PENDIENTE,
        observaciones: null,
        aprobado_el: null,
      },
    });

    return res.json({ success: true, application: mapApplication(updated) });
  } catch (error) {
    console.error('Error enviando solicitud de abogado:', error);
    return res.status(500).json({ success: false, message: 'Error enviando solicitud' });
  }
};

const reviewApplication = async (req, res) => {
  try {
    const personaId = Number(req.params.personaId);
    if (!personaId) {
      return res.status(400).json({ success: false, message: 'personaId inválido' });
    }

    const isAdmin = await ensureAdmin(req.ctx?.rolId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const estado = sanitizeString(req.body?.estado).toUpperCase();
    const observaciones = sanitizeString(req.body?.observaciones);
    const force = Boolean(req.body?.force);

    if (!estado) {
      return res.status(400).json({ success: false, message: 'estado es requerido' });
    }

    if (!Object.values(EstadoVerificacion).includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado de verificación inválido' });
    }

    const application = await prisma.verificacionabogado.findUnique({
      where: { persona_id: personaId },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    const current = application.estado;
    const allowedTransitions = {
      [EstadoVerificacion.PENDIENTE]: [
        EstadoVerificacion.APROBADA,
        EstadoVerificacion.OBSERVADA,
        EstadoVerificacion.RECHAZADA,
      ],
      [EstadoVerificacion.OBSERVADA]: [
        EstadoVerificacion.PENDIENTE,
        EstadoVerificacion.APROBADA,
        EstadoVerificacion.RECHAZADA,
      ],
      [EstadoVerificacion.RECHAZADA]: [EstadoVerificacion.PENDIENTE, EstadoVerificacion.OBSERVADA],
      [EstadoVerificacion.APROBADA]: [EstadoVerificacion.PENDIENTE, EstadoVerificacion.OBSERVADA],
    };

    if (!allowedTransitions[current] || !allowedTransitions[current].includes(estado)) {
      return res.status(409).json({ success: false, message: 'Transición no permitida' });
    }

    if (
      (current === EstadoVerificacion.RECHAZADA || current === EstadoVerificacion.APROBADA) &&
      !force
    ) {
      return res.status(409).json({
        success: false,
        message: 'Se requiere force=true para modificar una solicitud finalizada',
      });
    }

    if (estado === EstadoVerificacion.OBSERVADA && !observaciones) {
      return res.status(400).json({
        success: false,
        message: 'Debes indicar observaciones para una solicitud observada',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.verificacionabogado.update({
        where: { persona_id: personaId },
        data: {
          estado,
          observaciones:
            estado === EstadoVerificacion.OBSERVADA
              ? observaciones
              : estado === EstadoVerificacion.RECHAZADA
              ? observaciones || null
              : null,
          aprobado_el: estado === EstadoVerificacion.APROBADA ? new Date() : null,
        },
      });

      if (estado === EstadoVerificacion.APROBADA) {
        await ensureLawyerAccount(tx, personaId);
      }

      return result;
    });

    return res.json({ success: true, application: mapApplication(updated) });
  } catch (error) {
    console.error('Error revisando solicitud de abogado:', error);
    return res.status(500).json({ success: false, message: 'Error actualizando solicitud' });
  }
};

module.exports = {
  getOwnApplication,
  submitApplication,
  reviewApplication,
};