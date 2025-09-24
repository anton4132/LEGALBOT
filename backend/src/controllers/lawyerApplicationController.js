// controllers/lawyerVerification.controller.js
const { EstadoVerificacion } = require('@prisma/client');
const { prisma } = require('../config/database');

// ---------- helpers ----------
const sanitizeString = (v) => (typeof v === 'string' ? v.trim() : '');

const isValidUrl = (value) => {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// Permite ISO (recomendado) y dd/MM/yyyy (opcional).
const parseDate = (v) => {
  if (!v || typeof v !== 'string') return null;
  const iso = new Date(v);
  if (!Number.isNaN(iso.getTime())) return iso;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

// Mapea la solicitud incluyendo colegiatura y colegio
const mapApplication = (row) => {
  if (!row) return null;
  const c = row.colegiatura || null;
  const col = c?.colegio || null;

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
    colegiatura: c
      ? {
          id: c.id,
          personaId: c.persona_id,
          colegioId: c.colegio_id,
          numero: c.numero,
          carnet: c.carnet ?? null,
          fechaEmision: c.fecha_emision,
          fechaVigenciaHasta: c.fecha_vigencia_hasta,
          colegio: col
            ? {
                id: col.id,
                nombre: col.nombre,
                region: col.region,
              }
            : null,
        }
      : null,
  };
};

const ensureAdmin = async (rolId) => {
  if (!rolId) return false;
  const role = await prisma.role.findUnique({ where: { id: rolId } });
  const code = (role?.codigo || '').toLowerCase();
  return code === 'admin' || code === 'superadmin';
};


const createOrActivateAbogadoUser = async (tx, personaId) => {
  // 1) rol 'abogado' case-insensitive
  const lawyerRole = await tx.role.findFirst({
    where: { codigo: { equals: 'abogado', mode: 'insensitive' } },
  });
  if (!lawyerRole) {
    throw new Error('ROLE_ABOGADO_MISSING');
  }

  // 2) ¿ya existe usuario abogado?
  let lawyerUser = await tx.usuario.findFirst({
    where: { persona_id: personaId, rol_id: lawyerRole.id },
  });
  if (lawyerUser) {
    if (!lawyerUser.activo) {
      lawyerUser = await tx.usuario.update({
        where: { id: lawyerUser.id },
        data: { activo: true },
      });
    }
    return lawyerUser;
  }

  // 3) tomar cuenta base NO abogado para copiar la clave (hash)
  const baseUser = await tx.usuario.findFirst({
    where: {
      persona_id: personaId,
      role: { codigo: { not: 'abogado', mode: 'insensitive' } },
    },
    orderBy: { id: 'asc' },
  });
  if (!baseUser) {
    throw new Error('BASE_USER_MISSING'); // no hay cuenta previa desde la cual copiar clave
  }

  // 4) crear usuario abogado duplicando SOLO la clave
  const newLawyer = await tx.usuario.create({
    data: {
      persona_id: personaId,
      rol_id: lawyerRole.id,
      clave: baseUser.clave, // <— SOLO contraseña (hash)
      activo: true,          // aprobado => habilitado
    },
  });

  return newLawyer;
};

// ---------- controladores ----------
const getOwnApplication = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const application = await prisma.verificacionabogado.findUnique({
      where: { persona_id: personaId },
      include: { colegiatura: { include: { colegio: true } } },
    });

    return res.json({ success: true, application: mapApplication(application) });
  } catch (error) {
    console.error('Error obteniendo verificación de abogado:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error obteniendo verificación' });
  }
};

const submitApplication = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    // ----- datos que llegan del app -----
    const linkedinUrl = sanitizeString(req.body?.linkedinUrl);
    const tituloUrl = sanitizeString(req.body?.tituloUrl);

    const colegiaturaNumero = sanitizeString(req.body?.colegiaturaNumero);
    const colegiaturaCarnet = sanitizeString(req.body?.colegiaturaCarnet); // opcional
    const colegioNombre = sanitizeString(req.body?.colegioNombre);
    const colegioRegion = sanitizeString(req.body?.colegioRegion);

    const fechaEmision = parseDate(req.body?.colegiaturaFechaEmision);
    const fechaVigencia = parseDate(req.body?.colegiaturaFechaVigenciaHasta);

    // Validaciones básicas
    if (!isValidUrl(linkedinUrl) || !isValidUrl(tituloUrl)) {
      return res.status(400).json({
        success: false,
        message: 'linkedinUrl y tituloUrl deben ser URLs válidas (http/https)',
      });
    }
    if (!colegiaturaNumero) {
      return res.status(400).json({ success: false, message: 'colegiaturaNumero es requerido' });
    }
    if (!colegioNombre) {
      return res.status(400).json({ success: false, message: 'colegioNombre es requerido' });
    }
    if (fechaEmision && fechaVigencia && fechaVigencia < fechaEmision) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de vigencia no puede ser anterior a la de emisión',
      });
    }

    // Persona + roles (sólo para bloquear doble rol activo por error)
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: { usuario: { include: { role: true } } },
    });
    if (!persona) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }
    const hasActiveLawyerRole = (persona.usuario || []).some(
      (u) => (u.role?.codigo || '').toLowerCase() === 'abogado' && u.activo,
    );
    if (hasActiveLawyerRole) {
      return res
        .status(409)
        .json({ success: false, message: 'Ya cuentas con un perfil de abogado activo' });
    }

    // Transacción: upsert de verificación, colegio y colegiatura
    const result = await prisma.$transaction(async (tx) => {
      // 1) verificación (si existe y quedó OBSERVADA, vuelve a PENDIENTE y no borra URLs)
      let verification = await tx.verificacionabogado.findUnique({
        where: { persona_id: personaId },
      });

      if (!verification) {
        verification = await tx.verificacionabogado.create({
          data: {
            persona_id: personaId,
            linkedin_url: linkedinUrl,
            titulo_url: tituloUrl,
            estado: EstadoVerificacion.PENDIENTE,
            observaciones: null,
            aprobado_el: null,
          },
        });
      } else {
        if (verification.estado === EstadoVerificacion.PENDIENTE)
          throw new Error('PENDING_ALREADY');
        if (verification.estado === EstadoVerificacion.APROBADA)
          throw new Error('APPROVED_ALREADY');
        if (verification.estado === EstadoVerificacion.RECHAZADA)
          throw new Error('REJECTED_ALREADY');

        verification = await tx.verificacionabogado.update({
          where: { persona_id: personaId },
          data: {
            linkedin_url: verification.linkedin_url || linkedinUrl,
            titulo_url: verification.titulo_url || tituloUrl,
            estado: EstadoVerificacion.PENDIENTE,
            observaciones: null,
            aprobado_el: null,
          },
        });
      }

      // 2) colegio: buscar por (nombre, region) insensible; NO duplicar si ya existe
      const colegio =
        (await tx.colegioabogado.findFirst({
          where: {
            nombre: { equals: colegioNombre, mode: 'insensitive' },
            OR: [
              { region: colegioRegion ? { equals: colegioRegion, mode: 'insensitive' } : undefined },
              { region: null },
            ].filter(Boolean),
          },
        })) ||
        (await tx.colegioabogado.create({
          data: { nombre: colegioNombre, region: colegioRegion || null },
        }));

      // 3) colegiatura: upsert por persona_id + validar unicidad (colegio_id, numero)
      let colegiatura = await tx.colegiaturaabogado.findUnique({
        where: { persona_id: personaId },
      });

      if (!colegiatura) {
        colegiatura = await tx.colegiaturaabogado.create({
          data: {
            persona_id: personaId,
            colegio_id: colegio.id,
            numero: colegiaturaNumero,
            carnet: colegiaturaCarnet || null,
            fecha_emision: fechaEmision || null,
            fecha_vigencia_hasta: fechaVigencia || null,
          },
        });
      } else {
        if (colegiatura.numero !== colegiaturaNumero || colegiatura.colegio_id !== colegio.id) {
          const dup = await tx.colegiaturaabogado.findFirst({
            where: {
              colegio_id: colegio.id,
              numero: colegiaturaNumero,
              NOT: { id: colegiatura.id },
            },
          });
          if (dup) throw new Error('DUP_COLE_NUM');
        }

        colegiatura = await tx.colegiaturaabogado.update({
          where: { id: colegiatura.id },
          data: {
            colegio_id: colegio.id,
            numero: colegiaturaNumero,
            carnet: colegiaturaCarnet || null,
            fecha_emision: fechaEmision || null,
            fecha_vigencia_hasta: fechaVigencia || null,
          },
        });
      }

      // 4) vincular verificación ↔ colegiatura
      if (verification.colegiatura_id !== colegiatura.id) {
        verification = await tx.verificacionabogado.update({
          where: { persona_id: personaId },
          data: { colegiatura_id: colegiatura.id },
        });
      }

      // devolver payload completo
      return tx.verificacionabogado.findUnique({
        where: { persona_id: personaId },
        include: { colegiatura: { include: { colegio: true } } },
      });
    });

    return res.status(verificationWasCreated(result) ? 201 : 200).json({
      success: true,
      application: mapApplication(result),
    });
  } catch (error) {
    if (error.message === 'PENDING_ALREADY') {
      return res.status(409).json({ success: false, message: 'Tu solicitud ya está en revisión' });
    }
    if (error.message === 'APPROVED_ALREADY') {
      return res.status(409).json({ success: false, message: 'Tu solicitud ya fue aprobada' });
    }
    if (error.message === 'REJECTED_ALREADY') {
      return res.status(409).json({
        success: false,
        message: 'Tu solicitud fue rechazada. Comunícate con soporte para más información',
      });
    }
    if (error.message === 'DUP_COLE_NUM') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una colegiatura registrada con ese número en el mismo colegio',
      });
    }

    console.error('Error enviando solicitud de abogado:', error);
    return res.status(500).json({ success: false, message: 'Error enviando solicitud' });
  }
};

// para decidir 201/200 arriba (heurística simple)
function verificationWasCreated(v) {
  return !v?.creado_el || (v.creado_el && v.creado_el.getTime() === v.actualizado_el?.getTime());
}

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
      [EstadoVerificacion.RECHAZADA]: [
        EstadoVerificacion.PENDIENTE,
        EstadoVerificacion.OBSERVADA,
      ],
      [EstadoVerificacion.APROBADA]: [
        EstadoVerificacion.PENDIENTE,
        EstadoVerificacion.OBSERVADA,
      ],
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
      // 1) actualizar estado de verificación
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
        include: { colegiatura: { include: { colegio: true } } },
      });

      // 2) SI Y SOLO SI quedó APROBADA => crear/activar usuario ABOGADO (duplicando SOLO la clave)
      if (estado === EstadoVerificacion.APROBADA) {
        await createOrActivateAbogadoUser(tx, personaId);
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
