// controllers/lawyerVerification.controller.js
const { EstadoVerificacion } = require('@prisma/client');
const { prisma } = require('../config/database');
const { resolveBlobPublicUrl, deleteBlob } = require('../utils/blob');


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


const parseArchivoPayload = (input) => {
  if (!input) return null;
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object' || data === null) return null;

  const ruta = sanitizeString(
    data.ruta || data.url || data.path || data.pathname,
  );
  if (!ruta) return null;

  const rawTamano = Number(data.tamano ?? data.size ?? data.bytes);
  const tamano = Number.isFinite(rawTamano)
    ? Math.max(0, Math.trunc(rawTamano))
    : null;
  const tipo = sanitizeString(
    data.tipo || data.mime || data.contentType || data.mimeType,
  );

  return {
    ruta,
    tamano,
    tipo: tipo || null,
  };
};

const mapArchivo = (archivo) => {
  if (!archivo) return null;
  const ruta = sanitizeString(archivo.ruta) || null;
  const isAbsolute = ruta
    ? ruta.startsWith('http://') || ruta.startsWith('https://')
    : false;
  const normalizedPath = !ruta
    ? null
    : isAbsolute
    ? ruta
    : ruta.startsWith('/')
    ? ruta
    : `/${ruta}`;
  const fullUrl = !normalizedPath
    ? null
    : isAbsolute
    ? normalizedPath
    : resolveBlobPublicUrl(normalizedPath);

  return {
    id: archivo.id,
    ruta,
    tamano: archivo.tamano,
    tipo: archivo.tipo,
    url: fullUrl,
  };
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
    tituloUrl: row.titulo_url || row.titulo?.ruta || null,
    tituloArchivo: mapArchivo(row.titulo),
    observaciones: row.observaciones,
    aprobadoEl: row.aprobado_el,
    creadoEl: row.creado_el,
    actualizadoEl: row.actualizado_el,
    tituloArchivoId: row.titulo_archivo_id,
    colegiaturaCarnetArchivo: mapArchivo(row.colegiatura?.carnet_archivo),
    colegiaturaCarnetArchivoId: row.colegiatura?.carnet_archivo_id ?? null,
    colegiaturaNumero: c?.numero || null,
    colegiaturaFechaEmision: c?.fecha_emision || null,
    colegiaturaFechaVigenciaHasta: c?.fecha_vigencia_hasta || null,
    colegioNombre: col?.nombre || null,
    colegioRegion: col?.region || null,
    colegioId: col?.id || null,
    colegiatura: c
      ? {
          id: c.id,
          personaId: c.persona_id,
          colegioId: c.colegio_id,
          numero: c.numero,
          fechaEmision: c.fecha_emision,
          fechaVigenciaHasta: c.fecha_vigencia_hasta,
          carnetArchivo: mapArchivo(c.carnet_archivo),
          carnetArchivoId: c.carnet_archivo_id,
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
const fetchApplicationWithRelations = async (client, where) => {
  const base = await client.verificacionabogado.findUnique({
    where,
    include: {
      colegiatura: { include: { colegio: true } },
    },
  });
  if (!base) return null;

  const tituloPromise = base.titulo_archivo_id
  ? client.archivo.findUnique({ where: { id: base.titulo_archivo_id } })
  : Promise.resolve(null);

  const carnetPromise = base.colegiatura?.carnet_archivo_id
    ? client.archivo.findUnique({
        where: { id: base.colegiatura.carnet_archivo_id },
      })
    : Promise.resolve(null);

  const [titulo, carnetArchivo] = await Promise.all([
    tituloPromise,
    carnetPromise,
  ]);

  const colegiatura = base.colegiatura
    ? { ...base.colegiatura, carnet_archivo: carnetArchivo || null }
    : null;
    return {
      ...base,
      titulo: titulo || null,
      colegiatura,
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
      persona: { connect: { id: personaId } },
      role: { connect: { id: lawyerRole.id } },
      clave: baseUser.clave, // <— SOLO contraseña (hash)
      activo: true,          // aprobado => habilitado
    },
  });

  return newLawyer;
};

const deactivateAbogadoUser = async (tx, personaId) => {
  const lawyerRole = await tx.role.findFirst({
    where: { codigo: { equals: 'abogado', mode: 'insensitive' } },
  });
  if (!lawyerRole) {
    return;
  }

  await tx.usuario.updateMany({
    where: { persona_id: personaId, rol_id: lawyerRole.id },
    data: { activo: false },
  });
};

// ---------- controladores ----------
const getOwnApplication = async (req, res) => {
  try {
    const personaId = req.ctx?.personaId;
    if (!personaId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

   
    const application = await fetchApplicationWithRelations(prisma, {
      persona_id: personaId,
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
    const usuarioId = req.ctx?.usuarioId;
    if (!personaId || !usuarioId) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    // ----- datos que llegan del app -----
    const linkedinUrl = sanitizeString(req.body?.linkedinUrl);
    let tituloArchivo = parseArchivoPayload(req.body?.tituloArchivo);
    const legacyTituloUrl = sanitizeString(req.body?.tituloUrl);
    if (!tituloArchivo && isValidUrl(legacyTituloUrl)) {
      tituloArchivo = { ruta: legacyTituloUrl, tamano: null, tipo: null };
    }

    let carnetArchivo = parseArchivoPayload(req.body?.colegiaturaCarnetArchivo);
    const legacyCarnet = sanitizeString(req.body?.colegiaturaCarnet);
    if (!carnetArchivo && legacyCarnet) {
      carnetArchivo = { ruta: legacyCarnet, tamano: null, tipo: null };
    }

    let tituloArchivoId;
    let tituloArchivoIdProvided = false;
    if (Object.prototype.hasOwnProperty.call(req.body, 'tituloArchivoId')) {
      tituloArchivoIdProvided = true;
      const raw = req.body.tituloArchivoId;
      if (raw === null || raw === undefined || raw === '') {
        tituloArchivoId = null;
      } else {
        const parsed = Number(raw);
        tituloArchivoId = Number.isInteger(parsed) ? parsed : null;
      }
    }

    let carnetArchivoId;
    let carnetArchivoIdProvided = false;
    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        'colegiaturaCarnetArchivoId',
      )
    ) {
      carnetArchivoIdProvided = true;
      const raw = req.body.colegiaturaCarnetArchivoId;
      if (raw === null || raw === undefined || raw === '') {
        carnetArchivoId = null;
      } else {
        const parsed = Number(raw);
        carnetArchivoId = Number.isInteger(parsed) ? parsed : null;
      }
    }


    const colegiaturaNumero = sanitizeString(req.body?.colegiaturaNumero);
    const colegioNombre = sanitizeString(req.body?.colegioNombre);
    const colegioRegion = sanitizeString(req.body?.colegioRegion);
    const fechaEmision = parseDate(req.body?.colegiaturaFechaEmision);
    const fechaVigencia = parseDate(req.body?.colegiaturaFechaVigenciaHasta);

    // Validaciones básicas
    if (!isValidUrl(linkedinUrl)) {
      return res.status(400).json({
        success: false,
        message: 'linkedinUrl debe ser una URL válida (http/https)',
      });
    }
    const hasTituloArchivo = Boolean(tituloArchivo) ||
      (tituloArchivoIdProvided && tituloArchivoId != null);
    if (!hasTituloArchivo) {
      return res.status(400).json({
        success: false,
        message: 'Debes adjuntar el archivo digital de tu título profesional',
      });
    }
    const hasCarnetArchivo = Boolean(carnetArchivo) ||
      (carnetArchivoIdProvided && carnetArchivoId != null);
    if (!hasCarnetArchivo) {
      return res.status(400).json({
        success: false,
        message: 'Debes adjuntar el archivo digital de tu carnet de colegiatura',
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
    const blobsToDelete = [];
    const result = await prisma.$transaction(async (tx) => {
      const archivoIdsToDelete = [];

      // 1) verificación (si existe y quedó OBSERVADA, vuelve a PENDIENTE y no borra URLs)
      let verification = await tx.verificacionabogado.findUnique({
        where: { persona_id: personaId },
        include: {
          titulo: true,
          colegiatura: { include: { carnet_archivo: true } },
        },
      });

      let colegiatura = verification?.colegiatura ||
        (await tx.colegiaturaabogado.findUnique({
          where: { persona_id: personaId },
          include: { carnet_archivo: true },
        }));

      const previousTituloArchivo =
        verification?.titulo?.usuario_id === usuarioId ? verification.titulo : null;
      const previousCarnetArchivo =
        colegiatura?.carnet_archivo?.usuario_id === usuarioId
          ? colegiatura.carnet_archivo
          : null;

      let tituloArchivoIdToUse = verification?.titulo_archivo_id ?? null;
      if (tituloArchivo) {
        if (previousTituloArchivo?.ruta) {
          blobsToDelete.push(previousTituloArchivo.ruta);
        }
        if (previousTituloArchivo?.id) {
          archivoIdsToDelete.push(previousTituloArchivo.id);
        }
        const created = await tx.archivo.create({
          data: {
            usuario_id: usuarioId,
            ruta: tituloArchivo.ruta,
            tamano: tituloArchivo.tamano ?? 0,
            tipo: tituloArchivo.tipo,
          },
        });
        tituloArchivoIdToUse = created.id;
      } else if (tituloArchivoIdProvided) {
        if (tituloArchivoId === null) {
          tituloArchivoIdToUse = null;
        } else {
          const owned = await tx.archivo.findUnique({
            where: { id: tituloArchivoId },
          });
          if (!owned || owned.usuario_id !== usuarioId) {
            throw new Error('ARCHIVO_TITULO_INVALIDO');
          }
          tituloArchivoIdToUse = owned.id;
        }
      }

      if (!verification) {
        verification = await tx.verificacionabogado.create({
          data: {
            persona_id: personaId,
            linkedin_url: linkedinUrl,
            titulo_archivo_id: tituloArchivoIdToUse,
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
            linkedin_url: linkedinUrl,
            titulo_archivo_id: tituloArchivoIdToUse,
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
      

      let carnetArchivoIdToUse = colegiatura?.carnet_archivo_id ?? null;
      if (carnetArchivo) {
        if (previousCarnetArchivo?.ruta) {
          blobsToDelete.push(previousCarnetArchivo.ruta);
        }
        if (previousCarnetArchivo?.id) {
          archivoIdsToDelete.push(previousCarnetArchivo.id);
        }
        const createdCarnet = await tx.archivo.create({
          data: {
            usuario_id: usuarioId,
            ruta: carnetArchivo.ruta,
            tamano: carnetArchivo.tamano ?? 0,
            tipo: carnetArchivo.tipo,
          },
        });
        carnetArchivoIdToUse = createdCarnet.id;
      } else if (carnetArchivoIdProvided) {
        if (carnetArchivoId === null) {
          carnetArchivoIdToUse = null;
        } else {
          const ownedCarnet = await tx.archivo.findUnique({
            where: { id: carnetArchivoId },
          });
          if (!ownedCarnet || ownedCarnet.usuario_id !== usuarioId) {
            throw new Error('ARCHIVO_CARNET_INVALIDO');
          }
          carnetArchivoIdToUse = ownedCarnet.id;
        }
      }

      if (!colegiatura) {
        colegiatura = await tx.colegiaturaabogado.create({
          data: {
            persona_id: personaId,
            colegio_id: colegio.id,
            numero: colegiaturaNumero,
            carnet_archivo_id: carnetArchivoIdToUse,
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
            carnet_archivo_id: carnetArchivoIdToUse,
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

      if (archivoIdsToDelete.length) {
        await tx.archivo.deleteMany({
          where: {
            id: { in: archivoIdsToDelete },
            usuario_id: usuarioId,
          },
        });
      }

      // devolver payload completo
      return fetchApplicationWithRelations(tx, { persona_id: personaId });

    });

    if (archivoIdsToDelete.length) {
      await tx.archivo.deleteMany({
        where: {
          id: { in: archivoIdsToDelete },
          usuario_id: usuarioId,
        },
      });
    }

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

    if (error.message === 'ARCHIVO_TITULO_INVALIDO') {
      return res.status(400).json({
        success: false,
        message: 'El archivo de título proporcionado no es válido',
      });
    }
    if (error.message === 'ARCHIVO_CARNET_INVALIDO') {
      return res.status(400).json({
        success: false,
        message: 'El archivo de carnet proporcionado no es válido',
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
  if (!v) return false;
  if (!v.creado_el) return false;
  if (!v.actualizado_el) return true;
  return v.creado_el.getTime() === v.actualizado_el.getTime();
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

    const existingLawyerAccount = await prisma.usuario.findFirst({
      where: {
        persona_id: personaId,
        role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
      },
    });
    if (existingLawyerAccount && estado !== EstadoVerificacion.APROBADA) {
      return res.status(409).json({
        success: false,
        message: 'La persona ya cuenta con un rol de abogado. Deshabilita la cuenta desde la gestión de usuarios para revocar el acceso.',
      });
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
      await tx.verificacionabogado.update({
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

      // 2) SI Y SOLO SI quedó APROBADA => crear/activar usuario ABOGADO (duplicando SOLO la clave)
      if (estado === EstadoVerificacion.APROBADA) {
        await createOrActivateAbogadoUser(tx, personaId);
      } else if (
        estado === EstadoVerificacion.OBSERVADA ||
        estado === EstadoVerificacion.RECHAZADA
      ) {
        await deactivateAbogadoUser(tx, personaId);
      }

      return fetchApplicationWithRelations(tx, { persona_id: personaId });

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
