// controllers/userController.js
const { prisma } = require('../config/database');
const {
  BLOB_API_BASE_URL,
  resolveBlobPublicUrl,
  resolveBlobToken,
  normalizeBlobPath,
} = require('../utils/blob');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}
// ========== Utiles comunes ==========
const INVALID_DNI_SEQUENCES = ['00000000', '11111111', '12345678', '87654321'];

function validateDniFormat(dni) {
  if (!/^\d{8}$/.test(dni)) return 'El DNI debe contener exactamente 8 dígitos';
  if (INVALID_DNI_SEQUENCES.includes(dni)) return 'El DNI proporcionado no es válido';
  return null;
}

function dayNameToNum(name) {
  const map = {
    'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Miercoles': 3,
    'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Sabado': 6, 'Domingo': 7
  };
  return map[name] || null;
}

function hhmmToTimeDate(t) {
  if (!t) return null;
  const [hh, mm] = String(t).split(':');
  if (hh == null || mm == null) return null;
  // Devuelve Date local (Postgres TIME ignora fecha)
  return new Date(Date.UTC(1970, 0, 1, parseInt(hh, 10), parseInt(mm, 10), 0, 0));
}

function sanitizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
function normalizeOptionalStringInput(value) {
  if (value == null) return null;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'bigint') {
    return sanitizeString(String(value));
  }
  return null;
}

function toIntOrNull(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseAvatarId(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) {
      throw createHttpError(400, 'ID de archivo inválido', 'INVALID_AVATAR_ID');
    }
    return raw;
  }
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw createHttpError(400, 'ID de archivo inválido', 'INVALID_AVATAR_ID');
  }
  return parsed;
}

function normalizeArchivoPayload(input) {
  if (!input) return null;

  let payload = input;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      payload = JSON.parse(trimmed);
    } catch (error) {
      return { id: null, ruta: trimmed, tamano: null, tipo: null, url: null };
    }
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const id = toIntOrNull(payload.id ?? payload.archivoId ?? payload.archivo_id);
  const rutaRaw = payload.ruta ?? payload.path ?? payload.pathname ?? payload.url;
  const ruta = sanitizeString(rutaRaw);  
  const tamano = toIntOrNull(payload.tamano ?? payload.size ?? payload.tamaño);
  const tipo = sanitizeString(payload.tipo ?? payload.mime ?? payload.contentType);
  const url = sanitizeString(payload.url ?? payload.href);

  let resolvedRuta = ruta;
  if (url && (!resolvedRuta || !resolvedRuta.startsWith('http'))) {
    resolvedRuta = url;
  }

  if (id == null && !resolvedRuta) {
    return null;
  }

  return { id, ruta: resolvedRuta, tamano, tipo, url };
}

function mapArchivoResponse(archivo) {
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
  const fullUrl = archivo.url
    ? archivo.url
    : !normalizedPath
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
}
function mapColegiaturaResponse(record) {
  if (!record) return null;

  const colegio = record.colegio
    ? {
        id: record.colegio.id,
        nombre: record.colegio.nombre,
        region: record.colegio.region,
      }
    : null;

  return {
    id: record.id,
    persona_id: record.persona_id,
    colegio_id: record.colegio_id,
    numero: record.numero,
    fecha_emision: record.fecha_emision,
    fecha_vigencia_hasta: record.fecha_vigencia_hasta,
    carnet_archivo_id: record.carnet_archivo_id,
    carnet_archivo: mapArchivoResponse(record.carnet_archivo),
    colegio,
    creado_el: record.creado_el,
    actualizado_el: record.actualizado_el,
  };
}

function mapVerificacionResponse(record) {
  if (!record) return null;

  return {
    id: record.id,
    persona_id: record.persona_id,
    linkedin_url: record.linkedin_url,
    titulo_archivo_id: record.titulo_archivo_id,
    estado: record.estado,
    observaciones: record.observaciones,
    aprobado_el: record.aprobado_el,
    creado_el: record.creado_el,
    actualizado_el: record.actualizado_el,
    colegiatura_id: record.colegiatura_id,
    titulo: mapArchivoResponse(record.titulo),
    colegiatura: mapColegiaturaResponse(record.colegiatura),
  };
}


async function deleteBlobFile(path) {
  const normalized = normalizeBlobPath(path);
  if (!normalized) {
    return false;
  }
  const token = resolveBlobToken();
  if (!token) {
    console.warn('No se configuró BLOB_READ_WRITE_TOKEN; omitiendo eliminación de blob');
    return false;
  }
  try {
    const response = await fetch(`${BLOB_API_BASE_URL}/${normalized}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok || response.status === 404) {
      return true;
    }
    console.warn('Error eliminando blob:', response.status, await response.text());
  } catch (error) {
    console.warn('No se pudo eliminar el blob:', error);
  }
  return false;
}
async function cleanupOldAvatarArchivos(tx, userId, keepId = null) {
  const where = {
    usuario_id: userId,
    ruta: { contains: '/perfil/avatar/' },
  };

  if (keepId != null) {
    where.id = { not: keepId };
  }

  const candidates = await tx.archivo.findMany({
    where,
    include: { perfilabogado: true },
  });

  if (!candidates.length) {
    return;
  }

  const deletable = candidates.filter((archivo) => {
    return !archivo.perfilabogado?.some(
      (perfil) => perfil.avatar_archivo_id === archivo.id,
    );
  });

  if (!deletable.length) {
    return;
  }

  for (const archivo of deletable) {
    await deleteBlobFile(archivo.ruta);
  }

  const ids = deletable.map((archivo) => archivo.id);
  await tx.archivo.deleteMany({
    where: {
      usuario_id: userId,
      id: { in: ids },
    },
  });
}

async function resolveAvatarArchivo(tx, userId, avatarArchivoPayload, avatarArchivoId, avatarIdProvided) {
  let resolved = avatarIdProvided ? avatarArchivoId : undefined;
  let resolvedRecord = null;

  const archivoInput = normalizeArchivoPayload(avatarArchivoPayload);

  if (archivoInput) {
    if (archivoInput.id != null) {
      const existing = await tx.archivo.findUnique({ where: { id: archivoInput.id } });
      if (!existing) {
        throw createHttpError(400, 'El archivo de avatar proporcionado no existe', 'AVATAR_NOT_FOUND');
      }
      if (existing.usuario_id !== userId) {
        throw createHttpError(403, 'No puedes usar ese archivo como avatar', 'AVATAR_NOT_OWNER');
      }

      const updates = {};
      const newRuta = archivoInput.ruta || existing.ruta;
      const rutaChanged = newRuta && newRuta !== existing.ruta;
      if (rutaChanged && existing.ruta && existing.ruta !== newRuta) {
        await deleteBlobFile(existing.ruta);
      }
      if (rutaChanged) updates.ruta = newRuta;
      if (archivoInput.tamano != null && archivoInput.tamano !== existing.tamano) {
        updates.tamano = Math.max(0, archivoInput.tamano);
      }
      if (archivoInput.tipo !== undefined && archivoInput.tipo !== existing.tipo) {
        updates.tipo = archivoInput.tipo || null;
      }
      resolvedRecord = Object.keys(updates).length
        ? await tx.archivo.update({ where: { id: existing.id }, data: updates })
        : existing;
      resolved = resolvedRecord.id;
    } else if (archivoInput.ruta) {
      const created = await tx.archivo.create({
        data: {
          usuario_id: userId,
          ruta: archivoInput.ruta,
          tamano: Math.max(0, archivoInput.tamano ?? 0),
          tipo: archivoInput.tipo || null,
        },
      });
      resolvedRecord = created;
      resolved = created.id;
    }
  }

  if (resolved != null && resolvedRecord == null) {
    const existing = await tx.archivo.findUnique({ where: { id: resolved } });
    if (!existing) {
      throw createHttpError(400, 'El archivo de avatar indicado no existe', 'AVATAR_NOT_FOUND');
    }
    if (existing.usuario_id !== userId) {
      throw createHttpError(403, 'No puedes usar ese archivo como avatar', 'AVATAR_NOT_OWNER');
    }
    resolvedRecord = existing;
  }


  const shouldCleanup = avatarIdProvided || !!archivoInput;

  return { avatarId: resolved, avatarRecord: resolvedRecord, shouldCleanup };
}

function mapPerfilResponse(perfil) {
  if (!perfil) return null;
  const { avatar, ...rest } = perfil;
  return {
    ...rest,
    avatarArchivo: mapArchivoResponse(avatar),
  };
}

function buildPersonaNombreCompleto(persona) {
  if (!persona) return null;
  const parts = [
    sanitizeString(persona.primer_nombre),
    sanitizeString(persona.segundo_nombre),
    sanitizeString(persona.apellido_paterno),
    sanitizeString(persona.apellido_materno),
  ].filter(Boolean);
  return parts.join(' ').trim() || null;
}

function mapEstudioPublicSummary(estudio) {
  if (!estudio) return null;
  const direccionRelacion = estudio.direccion || null;
  const departamento = sanitizeString(direccionRelacion?.departamento);
  const provincia = sanitizeString(direccionRelacion?.provincia);
  const distrito = sanitizeString(direccionRelacion?.distrito);
  const direccionUbigeoCodigo = sanitizeString(
    estudio.direccion_id
    ?? direccionRelacion?.ubigeo_codigo,
  );
  return {
    id: estudio.id,
    nombre_comercial: estudio.nombre_comercial,
    pais: estudio.pais,
    ciudad: estudio.ciudad,
    direccion: estudio.linea_exacta_direccion,
    telefono: estudio.telefono,
    correo_contacto: estudio.correo_contacto,
    direccion_ubigeo_codigo: direccionUbigeoCodigo,
    linea_exacta_direccion: estudio.linea_exacta_direccion,
    departamento,
    provincia,
    distrito,
  };
}

/**
 * Busca abogados públicos activos aplicando filtros de especialidad y ubicación.
 * Respuesta: Array<{ usuarioId, nombreCompleto, avatarArchivo, tarifa_base, rating_promedio, rating_cantidad, estudioPrincipal }>.
 */
const searchPublicLawyers = async (req, res) => {
  try {
    const {
      specialtyId,
      especialidadId,
      especialidad_id: especialidadIdAlt,
      departamento,
      province,
      provincia,
      district,
      distrito,
    } = req.query || {};

    const resolvedSpecialtyId = toIntOrNull(
      specialtyId
      ?? especialidadId
      ?? especialidadIdAlt,
    );
    const resolvedDepartamento = sanitizeString(departamento);
    const resolvedProvincia = sanitizeString(provincia ?? province);
    const resolvedDistrito = sanitizeString(distrito ?? district);

    const missingParams = [];
    if (resolvedSpecialtyId == null) missingParams.push('especialidadId');
    if (!resolvedDepartamento) missingParams.push('departamento');
    if (!resolvedProvincia) missingParams.push('provincia');
    if (!resolvedDistrito) missingParams.push('distrito');

    if (missingParams.length) {
      return res.status(400).json({
        message: `Faltan parámetros obligatorios: ${missingParams.join(', ')}`,
      });
    }
  

    const where = {
      usuario: {
        activo: true,
        role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
      },
    };

    where.especialidades = {
      some: { especialidad_id: resolvedSpecialtyId },
    };

    where.usuario.abogadoestudios = {
      some: {
        activo: true,
        estudio: {
          activo: true,
          direccion: {
            is: {
              departamento: { equals: resolvedDepartamento, mode: 'insensitive' },
              provincia: { equals: resolvedProvincia, mode: 'insensitive' },
              distrito: { equals: resolvedDistrito, mode: 'insensitive' },
            },
          },
        },
      },
    };

    const perfiles = await prisma.perfilabogado.findMany({
      where,
      include: {
        avatar: true,
        usuario: {
          include: {
            persona: true,
            abogadoestudios: {
              where: { activo: true, estudio: { activo: true } },
              include: { estudio: { include: { direccion: true } } },
            },
          },
        },
      },
      orderBy: {
        usuario: {
          persona: {
            primer_nombre: 'asc',
          },
        },
      },
    });

    const results = perfiles
      .map((perfil) => {
        const usuario = perfil.usuario;
        if (!usuario?.persona) return null;
        const perfilMapped = mapPerfilResponse(perfil);
        const principal = (usuario.abogadoestudios || [])
          .find((row) => row.principal) || (usuario.abogadoestudios || [])[0] || null;
        const estudioPrincipal = principal?.estudio
          ? mapEstudioPublicSummary(principal.estudio)
          : null;

        return {
          usuarioId: usuario.id,
          nombreCompleto: buildPersonaNombreCompleto(usuario.persona),
          avatarArchivo: perfilMapped?.avatarArchivo || null,
          tarifa_base: perfilMapped?.tarifa_base ?? null,
          rating_promedio: perfilMapped?.rating_promedio ?? null,
          rating_cantidad: perfilMapped?.rating_cantidad ?? 0,
          estudioPrincipal,
        };
      })
      .filter(Boolean);

    res.json(results);
  } catch (error) {
    console.error('Error buscando abogados públicos:', error);
    res.status(500).json({ message: 'Error buscando abogados' });
  }
};

/**
 * Devuelve un perfil público detallado de un abogado.
 * Respuesta: { usuarioId, nombreCompleto, persona, perfil, especialidades, estudios, estudioPrincipal }.
 */
const getPublicLawyerProfile = async (req, res) => {
  try {
    const lawyerId = parseInt(req.params.id, 10);
    if (Number.isNaN(lawyerId)) {
      return res.status(400).json({ message: 'ID de abogado inválido' });
    }

    const perfil = await prisma.perfilabogado.findFirst({
      where: {
        usuario_id: lawyerId,
        usuario: {
          activo: true,
          role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
        },
      },
      include: {
        avatar: true,
        especialidades: { include: { especialidad: true } },
        usuario: {
          include: {
            persona: true,
            abogadoestudios: {
              where: { activo: true, estudio: { activo: true } },
              include: { estudio: { include: { direccion: true } } },
            },
          },
        },
      },
    });

    if (!perfil) {
      return res.status(404).json({ message: 'Abogado no encontrado' });
    }

    const usuario = perfil.usuario;
    const persona = usuario?.persona || null;
    const perfilMapped = mapPerfilResponse(perfil);
    const especialidades = (perfil.especialidades || [])
      .map((row) => row.especialidad)
      .filter(Boolean);
    if (perfilMapped) {
      perfilMapped.especialidades = especialidades;
    }

    const estudios = (usuario?.abogadoestudios || []).map((row) => ({
      id: row.id,
      principal: row.principal,
      rol_en_estudio: row.rol_en_estudio,
      estudio: mapEstudioPublicSummary(row.estudio),
    }));
    const principal = (usuario?.abogadoestudios || []).find((row) => row.principal)
      || (usuario?.abogadoestudios || [])[0]
      || null;

    res.json({
      usuarioId: usuario.id,
      nombreCompleto: buildPersonaNombreCompleto(persona),
      persona: persona
        ? {
          primer_nombre: persona.primer_nombre,
          segundo_nombre: persona.segundo_nombre,
          apellido_paterno: persona.apellido_paterno,
          apellido_materno: persona.apellido_materno,
          telefono: persona.telefono,
          correo: persona.correo,
          direccion: persona.direccion,
          linea_exacta_direccion: persona.linea_exacta_direccion,

        }
        : null,
      perfil: perfilMapped,
      especialidades,
      estudios,
      estudioPrincipal: principal?.estudio
        ? mapEstudioPublicSummary(principal.estudio)
        : null,
    });
  } catch (error) {
    console.error('Error obteniendo perfil público del abogado:', error);
    res.status(500).json({ message: 'Error obteniendo perfil público del abogado' });
  }
};

/**
 * Obtiene la disponibilidad semanal y las citas reservadas dentro de un rango.
 * Respuesta: { range: { from, to }, availability: [...], bookings: [...] }.
 */
const getLawyerAvailabilityWithBookings = async (req, res) => {
  try {
    const lawyerId = parseInt(req.params.id, 10);
    if (Number.isNaN(lawyerId)) {
      return res.status(400).json({ message: 'ID de abogado inválido' });
    }

    const lawyer = await prisma.usuario.findFirst({
      where: {
        id: lawyerId,
        activo: true,
        role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
        perfilabogado: { isNot: null },
      },
      select: { id: true },
    });

    if (!lawyer) {
      return res.status(404).json({ message: 'Abogado no encontrado' });
    }

    const fromRaw = sanitizeString(req.query.from);
    const toRaw = sanitizeString(req.query.to);
    const now = new Date();
    const fromDate = fromRaw ? new Date(fromRaw) : now;
    if (Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ message: 'Parámetro "from" inválido' });
    }
    const defaultTo = new Date(fromDate.getTime());
    defaultTo.setDate(defaultTo.getDate() + 30);
    const toDate = toRaw ? new Date(toRaw) : defaultTo;
    if (Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Parámetro "to" inválido' });
    }

    if (toDate < fromDate) {
      return res.status(400).json({ message: 'El rango de fechas es inválido' });
    }

    const availability = await prisma.disponibilidadabogado.findMany({
      where: { abogado_id: lawyerId },
      orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    });

    const bookings = await prisma.cita.findMany({
      where: {
        abogado_id: lawyerId,
        estado: { in: ['pendiente', 'confirmada', 'completada'] },
        inicia_el: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        inicia_el: true,
        termina_el: true,
        estado: true,
      },
      orderBy: { inicia_el: 'asc' },
    });

    res.json({
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      availability: availability.map((slot) => ({
        ...slot,
        hora_inicio: slot.hora_inicio ? slot.hora_inicio.toISOString() : null,
        hora_fin: slot.hora_fin ? slot.hora_fin.toISOString() : null,
      })),
      bookings: bookings.map((booking) => ({
        ...booking,
        inicia_el: booking.inicia_el ? booking.inicia_el.toISOString() : null,
        termina_el: booking.termina_el ? booking.termina_el.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo disponibilidad pública del abogado:', error);
    res.status(500).json({ message: 'Error obteniendo disponibilidad del abogado' });
  }
};

/**
 * Lista combinaciones únicas de país y ciudad para filtros públicos.
 * Respuesta: Array<{ pais, ciudad }>.
 */
const listLawyerLocations = async (_req, res) => {
  try {
    const departamentosMap = new Map();

    const buildKey = (...parts) => parts
      .filter(Boolean)
      .map((part) => part.toString().toLowerCase())
      .join('|');

    const upsertFromRows = (rows = []) => {
      rows.forEach((direccion) => {
        const departamento = sanitizeString(direccion?.departamento);
        const provincia = sanitizeString(direccion?.provincia);
        const distrito = sanitizeString(direccion?.distrito);
        const ubigeoCodigo = sanitizeString(direccion?.ubigeo_codigo);

        if (!departamento || !provincia || !distrito) return;

        const departamentoCodigo = ubigeoCodigo ? ubigeoCodigo.slice(0, 2) : null;
        const provinciaCodigo = ubigeoCodigo ? ubigeoCodigo.slice(0, 4) : null;
        const distritoCodigo = ubigeoCodigo || null;

        const departamentoKey = buildKey(departamentoCodigo, departamento);

        if (!departamentosMap.has(departamentoKey)) {
          departamentosMap.set(departamentoKey, {
            departamento,
            departamento_codigo: departamentoCodigo,
            provincias: new Map(),
          });
        }

        const departamentoEntry = departamentosMap.get(departamentoKey);
        if (!departamentoEntry.departamento && departamento) {
          departamentoEntry.departamento = departamento;
        }
        if (!departamentoEntry.departamento_codigo && departamentoCodigo) {
          departamentoEntry.departamento_codigo = departamentoCodigo;
        }

        const provinciasMap = departamentoEntry.provincias;

        const provinciaKey = buildKey(provinciaCodigo, provincia);
        if (!provinciasMap.has(provinciaKey)) {
          provinciasMap.set(provinciaKey, {
            provincia,
            provincia_codigo: provinciaCodigo,
            distritos: new Map(),
          });
        }

        const provinciaEntry = provinciasMap.get(provinciaKey);
        if (!provinciaEntry.provincia && provincia) {
          provinciaEntry.provincia = provincia;
        }
        if (!provinciaEntry.provincia_codigo && provinciaCodigo) {
          provinciaEntry.provincia_codigo = provinciaCodigo;
        }

        const distritosMap = provinciaEntry.distritos;

        const distritoKey = buildKey(distritoCodigo, distrito);
        if (!distritosMap.has(distritoKey)) {
          distritosMap.set(distritoKey, {
            distrito,
            distrito_codigo: distritoCodigo,
            ubigeo_codigo: ubigeoCodigo || distritoCodigo,
          });
        }
      });
    };

    const activeDirecciones = await prisma.direccion.findMany({
        where: {
          departamento: { not: '' },
          provincia: { not: '' },
          distrito: { not: '' },
          estudio: {
          some: {
            activo: true,
            abogadoestudios: {
              some: {
                activo: true,
                usuario: {
                  activo: true,
                  role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
                },
              },
            },
          },
        },
        
      },
      select: {
        departamento: true,
        provincia: true,
        distrito: true,
        ubigeo_codigo: true,
      },
    });

    upsertFromRows(activeDirecciones);

    if (!departamentosMap.size) {
      const fallbackDirecciones = await prisma.direccion.findMany({
        where: {
          departamento: { not: '' },
          provincia: { not: '' },
          distrito: { not: '' },
        },
        select: {
          departamento: true,
          provincia: true,
          distrito: true,
          ubigeo_codigo: true,
        },
      });
      upsertFromRows(fallbackDirecciones);
    }

    const response = Array.from(departamentosMap.values())
    .map((departamentoEntry) => {
      const provincias = Array.from(departamentoEntry.provincias.values())
        .map((provinciaEntry) => {
          const distritos = Array.from(provinciaEntry.distritos.values())
            .sort((a, b) => (a.distrito || '').localeCompare(
              b.distrito || '',
              undefined,
              { sensitivity: 'base' },
            ));
          return {
            provincia: provinciaEntry.provincia,
            provincia_codigo: provinciaEntry.provincia_codigo,
            distritos,
          };
        })
        .sort((a, b) => (a.provincia || '').localeCompare(
          b.provincia || '',
          undefined,
          { sensitivity: 'base' },
        ));
      return {
          departamento: departamentoEntry.departamento,
          departamento_codigo: departamentoEntry.departamento_codigo,
          provincias,
        };
      })
      .sort((a, b) => (a.departamento || '').localeCompare(
        b.departamento || '',
        undefined,
        { sensitivity: 'base' },
      ));

    res.json(response);
  } catch (error) {
    console.error('Error listando ubicaciones de abogados:', error);
    res.status(500).json({ message: 'Error obteniendo ubicaciones disponibles' });
  }
};
// ========== API Perú (opcional) ==========
async function fetchDniInfo(dni) {
  const token = process.env.APIPERU_TOKEN;
  if (!token) throw new Error('APIPERU_TOKEN no configurado');

  const response = await fetch('https://apiperu.dev/api/dni', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ dni })
  });

  if (!response.ok) throw new Error('No se pudo verificar el DNI');
  const data = await response.json();
  if (!data.success) throw new Error('DNI no encontrado en padrón público');
  return data.data;
}

async function validateDni(dni) {
  const formatError = validateDniFormat(dni);
  if (formatError) return formatError;
  if (process.env.APIPERU_TOKEN) {
    try { await fetchDniInfo(dni); }
    catch (e) { return e.message || 'Error verificando DNI'; }
  }
  return null;
}

// ========== Endpoints auxiliares ==========
const lookupDni = async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const formatError = validateDniFormat(dni);
    if (formatError) return res.status(400).json({ success: false, message: formatError });

    const data = await fetchDniInfo(dni);
    const nombres = (data.nombres || '').trim().split(/\s+/);
    const structured = {
      numero: data.numero,
      primer_nombre: nombres[0] || '',
      segundo_nombre: nombres.slice(1).join(' ') || '',
      apellido_paterno: data.apellido_paterno || '',
      apellido_materno: data.apellido_materno || '',
    };
    res.json({ success: true, data: structured });
  } catch (error) {
    console.error('Error consultando DNI:', error);
    res.status(500).json({ success: false, message: error.message || 'Error consultando DNI' });
  }
};

const normalizeDigits = (value) => (value || '').replace(/\D/g, '');

const checkPersonaConflicts = async (req, res) => {
  try {
    const dniRaw = String(req.query.dni || '').trim();
    const telefonoRaw = String(req.query.telefono || '').trim();
    const correoRaw = String(req.query.correo || '').trim();

    if (!dniRaw && !telefonoRaw && !correoRaw) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un DNI, teléfono o correo para validar duplicados',
      });
    }

    const normalizedDni = normalizeDigits(dniRaw);
    const normalizedTelefono = normalizeDigits(telefonoRaw);
    const normalizedCorreo = correoRaw.toLowerCase();

    const conflicts = {};

    if (normalizedDni) {
      const personaByDni = await prisma.persona.findUnique({ where: { dni: normalizedDni } });
      conflicts.dni = Boolean(personaByDni);
    }

    if (normalizedTelefono) {
      const telefonoMatch = await prisma.$queryRaw`
        SELECT id
        FROM persona
        WHERE telefono IS NOT NULL
          AND regexp_replace(telefono, '\\D', '', 'g') = ${normalizedTelefono}
        LIMIT 1;
      `;
      conflicts.telefono = Array.isArray(telefonoMatch) && telefonoMatch.length > 0;
    }

    if (normalizedCorreo) {
      const personaByCorreo = await prisma.persona.findFirst({
        where: { correo: { equals: normalizedCorreo, mode: 'insensitive' } },
      });
      conflicts.correo = Boolean(personaByCorreo);
    }

    return res.json({
      success: true,
      data: {
        dni: normalizedDni || null,
        telefono: normalizedTelefono || null,
        correo: normalizedCorreo || null,
      },
      conflicts,
    });
  } catch (error) {
    console.error('Error validando duplicados de persona:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error validando duplicados de persona',
    });
  }
};

// Listar roles (el frontend lo necesita)
const getRoles = async (_req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
    res.json(roles);
  } catch (e) {
    console.error('Error obteniendo roles:', e);
    res.status(500).json({ success: false, message: 'Error obteniendo roles' });
  }
};

// ========== Helpers de dominio (abogado) ==========

// Asegura especialidades y devuelve array de IDs (acepta varios formatos de entrada)
async function ensureEspecialidades(tx, abogado_info = {}) {
  const ids = new Set();

  // Preferencia 1: arreglo de IDs ya existentes
  const idsEnviados = Array.isArray(abogado_info.especialidadesIds)
    ? abogado_info.especialidadesIds.map(Number).filter(n => !Number.isNaN(n))
    : [];

  if (idsEnviados.length) {
    const existentes = await tx.especialidad.findMany({
      where: { id: { in: idsEnviados } },
      select: { id: true }
    });
    existentes.forEach(e => ids.add(e.id));
  }

  // Preferencia 2: arreglo de nombres
  const nombres = Array.isArray(abogado_info.especialidadesNombres)
    ? abogado_info.especialidadesNombres.map(s => String(s).trim()).filter(Boolean)
    : [];

  for (const nombre of nombres) {
    const esp = await tx.especialidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
    ids.add(esp.id);
  }

  // Compatibilidad legacy: un solo nombre en `especialidad`
  if (abogado_info.especialidad && String(abogado_info.especialidad).trim()) {
    const nombre = String(abogado_info.especialidad).trim();
    const esp = await tx.especialidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
    ids.add(esp.id);
  }

  return Array.from(ids);
}

// Crea/actualiza el vínculo USUARIO-ESTUDIO (abogadoestudio) y devuelve {estudioId, abogadoEstudioId}
async function upsertAbogadoEstudio(tx, userId, estudioInput = {}, vinculoInput = {}) {
  const e = estudioInput || {};
  const v = vinculoInput || {};
  const hasData = ['ruc', 'nombre', 'nombre_comercial', 'pais', 'ciudad', 'correo', 'correo_contacto', 'telefono', 'direccion']
    .some(k => e[k] && String(e[k]).trim() !== '');
  if (!hasData) return null; // nada que hacer

  // Upsert de estudio por RUC si viene; si no, crea nuevo
  let estudio;
  if (e.ruc && String(e.ruc).trim() !== '') {
    estudio = await tx.estudio.upsert({
      where: { ruc: e.ruc },
      update: {
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      },
      create: {
        ruc: e.ruc,
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      }
    });
  } else {
    estudio = await tx.estudio.create({
      data: {
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      }
    });
  }

  // Upsert de abogadoestudio (único por usuario-estudio)
  const principal = !!(v.principal ?? e.principal);
  const rol_en_estudio = v.rol_en_estudio ?? e.rol_en_estudio ?? null;

  // Ver si existe el vínculo
  const existing = await tx.abogadoestudio.findFirst({
    where: { usuario_id: userId, estudio_id: estudio.id }
  });

  let vinculo;
  if (existing) {
    vinculo = await tx.abogadoestudio.update({
      where: { id: existing.id },
      data: {
        rol_en_estudio,
        principal,
        activo: true
      }
    });
  } else {
    vinculo = await tx.abogadoestudio.create({
      data: {
        usuario_id: userId,
        estudio_id: estudio.id,
        rol_en_estudio,
        principal,
        activo: true
      }
    });
  }

  // Si marcó principal, desmarca los demás
  if (principal) {
    await tx.abogadoestudio.updateMany({
      where: { usuario_id: userId, id: { not: vinculo.id } },
      data: { principal: false }
    });
  }

  return { estudioId: estudio.id, abogadoEstudioId: vinculo.id };
}

// Sincroniza la tabla pivote perfilabogado_especialidad
async function syncPerfilEspecialidades(tx, userId, nuevosIds = []) {
  const actuales = await tx.perfilabogado_especialidad.findMany({
    where: { perfilabogado_id: userId },
    select: { especialidad_id: true }
  });
  const setActual = new Set(actuales.map(a => a.especialidad_id));
  const setNuevo = new Set(nuevosIds);

  const porBorrar = [...setActual].filter(x => !setNuevo.has(x));
  const porCrear = [...setNuevo].filter(x => !setActual.has(x));

  await tx.perfilabogado_especialidad.deleteMany({
    where: { perfilabogado_id: userId, especialidad_id: { in: porBorrar } }
  });
  if (porCrear.length) {
    await tx.perfilabogado_especialidad.createMany({
      data: porCrear.map(eid => ({ perfilabogado_id: userId, especialidad_id: eid })),
      skipDuplicates: true
    });
  }
}

// ========== Listar / Obtener ==========
const getAllUsers = async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        persona: {
          include: {
            verificacionabogado: {
              include: {
                titulo: true,
                colegiatura: {
                  include: { colegio: true, carnet_archivo: true },
                },
              },
            },
            colegiatura: { include: { colegio: true, carnet_archivo: true } },
          },
        },
        role: true,
        perfilabogado: {
          include: {
            disponibilidadabogado: true,
            especialidades: { include: { especialidad: true } },
            avatar: true,
          }
        },
        abogadoestudios: {
          include: { estudio: { include: { direccion: true } } },
          where: { activo: true },
          orderBy: { principal: 'desc' }
        }
      },
      orderBy: { creado_el: 'desc' }
    });

    // Aplana especialidades para facilitar al front
    const data = usuarios.map(u => {
      const { perfilabogado, persona, ...rest } = u;

      const personaMapped = persona
        ? {
            ...persona,
            colegiatura: mapColegiaturaResponse(persona.colegiatura),
            verificacionabogado: mapVerificacionResponse(persona.verificacionabogado),
          }
        : null;      
      if (!perfilabogado) {
        return { ...rest, persona: personaMapped, perfilabogado: null };
      }
      const perfilMapped = mapPerfilResponse(perfilabogado);
      if (perfilMapped) {
        perfilMapped.especialidades = (perfilabogado.especialidades || []).map(pe => pe.especialidad);
      }
      return { ...rest, persona: personaMapped, perfilabogado: perfilMapped };
    });

    res.json(data);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
};

const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'ID inválido' });

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        persona: {
          include: {
            verificacionabogado: {
              include: {
                titulo: true,
                colegiatura: {
                  include: { colegio: true, carnet_archivo: true },
                },
              },
            },
            colegiatura: { include: { colegio: true, carnet_archivo: true } },
          },
        },
        role: true,
        perfilabogado: {
          include: {
            disponibilidadabogado: true,
            especialidades: { include: { especialidad: true } },
            avatar: true,          }
        },
        abogadoestudios: {
          include: { estudio: { include: { direccion: true } } },
          where: { activo: true },
          orderBy: { principal: 'desc' }
        }
      }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const { perfilabogado, persona, ...rest } = usuario;
    const perfilMapped = perfilabogado ? mapPerfilResponse(perfilabogado) : null;
    if (perfilMapped) {
      perfilMapped.especialidades = (perfilabogado.especialidades || []).map(pe => pe.especialidad);
    }
    const personaMapped = persona
      ? {
          ...persona,
          colegiatura: mapColegiaturaResponse(persona.colegiatura),
          verificacionabogado: mapVerificacionResponse(persona.verificacionabogado),
        }
      : null;
    const data = perfilabogado
    ? { ...rest, persona: personaMapped, perfilabogado: perfilMapped }
    : { ...rest, persona: personaMapped, perfilabogado: null };


    res.json({ success: true, user: data });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuario' });
  }
};

// ========== Crear ==========// ========== Crear (con attachToExisting) ==========
const createUser = async (req, res) => {
  try {
    const { persona, rol_id, clave, abogado_info, attachToExisting } = req.body || {};
    if (!rol_id || !clave) {
      return res.status(400).json({ success: false, message: 'rol_id y clave son requeridos' });
    }

    // ---------------------------
    // MODO 1: Adjuntar a persona existente
    // ---------------------------
    if (attachToExisting) {
      // Requerimos al menos DNI o correo para localizar la persona
      const dni = persona?.dni?.trim();
      const correo = persona?.correo?.trim();

      if (!dni && !correo) {
        return res.status(400).json({ success: false, message: 'Para attachToExisting se requiere persona.dni o persona.correo' });
      }

      // Validar formato de DNI si viene
      if (dni) {
        const dniError = await validateDni(dni);
        if (dniError) return res.status(400).json({ success: false, message: dniError });
      }

      // Buscar persona por DNI o correo (prefiere DNI si existe)
      let personaExist = null;
      if (dni) {
        personaExist = await prisma.persona.findUnique({ where: { dni } });
      }
      if (!personaExist && correo) {
        personaExist = await prisma.persona.findUnique({ where: { correo } });
      }
      if (!personaExist) {
        return res.status(404).json({ success: false, message: 'Persona no encontrada para adjuntar cuenta' });
      }

      // Transacción: crear nueva fila en `usuario` si no existe ya ese rol
      const result = await prisma.$transaction(async (tx) => {
        // Evitar duplicar el mismo rol para la persona
        const dup = await tx.usuario.findUnique({
          where: { persona_id_rol_id: { persona_id: personaExist.id, rol_id: parseInt(rol_id, 10) } }
        });
        if (dup) {
          throw new Error('La persona ya tiene una cuenta con ese rol');
        }

        const usuarioCreated = await tx.usuario.create({
          data: {
            persona_id: personaExist.id,
            rol_id: parseInt(rol_id, 10),
            clave, // IMPORTANTE: hashear a nivel de servicio
            telefono_verificado: false,
            activo: true
          }
        });

        // Si no es abogado o no mandan info, retornar básico
        const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id, 10) } });
        if (!rol || rol.codigo !== 'abogado' || !abogado_info) {
          return tx.usuario.findUnique({
            where: { id: usuarioCreated.id },
            include: { persona: true, role: true }
          });
        }

        // === PERFIL ABOGADO ===
        await tx.perfilabogado.create({
          data: {
            usuario_id: usuarioCreated.id,
            tarifa_base: abogado_info.tarifabase ?? null,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null
          }
        });

        // === ESPECIALIDADES ===
        const nombresEspecialidades = Array.isArray(abogado_info.especialidades)
          ? abogado_info.especialidades
          : (abogado_info.especialidad ? [abogado_info.especialidad] : []);
        if (nombresEspecialidades.length) {
          const especialidadRows = await Promise.all(
            nombresEspecialidades
              .map(n => n && n.trim())
              .filter(Boolean)
              .map(nombre =>
                tx.especialidad.upsert({
                  where: { nombre },
                  update: {},
                  create: { nombre }
                })
              )
          );
          await tx.perfilabogado_especialidad.createMany({
            data: especialidadRows.map(esp => ({
              perfilabogado_id: usuarioCreated.id,
              especialidad_id: esp.id
            })),
            skipDuplicates: true
          });
        }

        // === ESTUDIO + vínculo abogadoestudio ===
        const e = abogado_info.estudio || {};
        if (Object.keys(e).length) {
          let estudioRow;
          if (e.ruc && e.ruc.trim() !== '') {
            estudioRow = await tx.estudio.upsert({
              where: { ruc: e.ruc },
              update: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              },
              create: {
                ruc: e.ruc,
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          } else {
            estudioRow = await tx.estudio.create({
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          }

          await tx.abogadoestudio.create({
            data: {
              usuario_id: usuarioCreated.id,
              estudio_id: estudioRow.id,
              principal: true,
              rol_en_estudio: e.rol || null,
              activo: true
            }
          });
        }

        // === DISPONIBILIDAD ===
        const disp = (abogado_info.disponibilidad || [])
          .map(s => {
            const dia = dayNameToNum(s.dia);
            const ini = hhmmToTimeDate(s.hora_inicio);
            const fin = hhmmToTimeDate(s.hora_fin);
            if (!dia || !ini || !fin) return null;
            return { dia, ini, fin };
          })
          .filter(Boolean);

        if (disp.length) {
          await tx.disponibilidadabogado.createMany({
            data: disp.map(s => ({
              abogado_id: usuarioCreated.id,
              dia_semana: s.dia,
              hora_inicio: s.ini,
              hora_fin: s.fin
            })),
            skipDuplicates: true
          });
        }

        return tx.usuario.findUnique({
          where: { id: usuarioCreated.id },
          include: {
            persona: true,
            role: true,
            perfilabogado: {
              include: {
                disponibilidadabogado: true,
                especialidades: { include: { especialidad: true } },
                avatar: true,              }
            },
            abogadoestudios: {
              include: { estudio: { include: { direccion: true } } },
              where: { activo: true },
              orderBy: { principal: 'desc' }
            }
          }
        });
      });
      const { perfilabogado, ...rest } = result || {};
      const perfilMapped = perfilabogado ? mapPerfilResponse(perfilabogado) : null;
      if (perfilMapped) {
        perfilMapped.especialidades = (perfilabogado.especialidades || []).map(pe => pe.especialidad);
      }

      const user = result?.perfilabogado
      ? { ...rest, perfilabogado: perfilMapped }

        : result;

      return res.status(201).json({ success: true, message: 'Cuenta agregada a persona existente', user });
    }

    // ---------------------------
    // MODO 2: Crear persona + usuario (comportamiento actual)
    // ---------------------------
    if (!persona) {
      return res.status(400).json({ success: false, message: 'Faltan datos de persona' });
    }
    const {
      dni,
      telefono,
      correo,
      primer_nombre,
      segundo_nombre,
      apellido_paterno,
      apellido_materno,
      direccion,
      direccion_id: direccionIdRaw,
      linea_exacta_direccion: lineaExactaDireccionRaw,
    } = persona;

    if (!dni || !correo || !primer_nombre || !apellido_paterno) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos en persona' });
    }

    const normalizedDni = String(dni).trim();
    const dniError = await validateDni(normalizedDni);
    if (dniError) return res.status(400).json({ success: false, message: dniError });

    // Unicidad de persona (solo en modo crear persona)
    const [personaByDni, personaByCorreo] = await Promise.all([
      prisma.persona.findUnique({ where: { dni: normalizedDni } }),
      prisma.persona.findUnique({ where: { correo } })
    ]);
    if (personaByDni && personaByCorreo && personaByDni.id !== personaByCorreo.id) {
      return res.status(409).json({ success: false, message: 'DNI y correo pertenecen a personas diferentes' });
    }
    const personaExistente = personaByDni || personaByCorreo;

    // Si existe, validar que no tenga ya el mismo rol
    if (personaExistente) {
      const existingUserRole = await prisma.usuario.findFirst({
        where: { persona_id: personaExistente.id, rol_id: parseInt(rol_id, 10) }
      });
      if (existingUserRole) {
        return res.status(409).json({ success: false, message: 'La persona ya posee un usuario con ese rol' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let personaId;
      if (personaExistente) {
        personaId = personaExistente.id;
      } else {
        const personaData = {
          dni: normalizedDni,
          telefono: telefono || null,
          correo,
          primer_nombre,
          segundo_nombre: segundo_nombre || null,
          apellido_paterno,
          apellido_materno: apellido_materno || null,
        };

        const hasLineaExacta = hasOwn(persona, 'linea_exacta_direccion') || hasOwn(persona, 'direccion');
        if (hasLineaExacta) {
          const resolvedLineaExacta = hasOwn(persona, 'linea_exacta_direccion')
            ? normalizeOptionalStringInput(lineaExactaDireccionRaw)
            : normalizeOptionalStringInput(direccion);
          personaData.linea_exacta_direccion = resolvedLineaExacta;
        }

        if (hasOwn(persona, 'direccion_id')) {
          personaData.direccion_id = normalizeOptionalStringInput(direccionIdRaw);
        }

        const personaCreated = await tx.persona.create({ data: personaData });
        personaId = personaCreated.id;
      }

      const usuarioCreated = await tx.usuario.create({
        data: {
          persona_id: personaId,
          rol_id: parseInt(rol_id, 10),
          clave, // IMPORTANTE: hashear a nivel de servicio
          telefono_verificado: false,
          activo: true
        }
      });

      // Si no es abogado, termina aquí
      const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id, 10) } });
      if (!rol || rol.codigo !== 'abogado' || !abogado_info) {
        return tx.usuario.findUnique({
          where: { id: usuarioCreated.id },
          include: { persona: true, role: true }
        });
      }

      // === PERFIL ABOGADO ===
      await tx.perfilabogado.create({
        data: {
          usuario_id: usuarioCreated.id,
          tarifa_base: abogado_info.tarifabase ?? null,
          direccion_atencion: abogado_info.direccionAtencion || null,
          bio: abogado_info.biografia || null
        }
      });

      // === ESPECIALIDADES ===
      const nombresEspecialidades = Array.isArray(abogado_info.especialidades)
        ? abogado_info.especialidades
        : (abogado_info.especialidad ? [abogado_info.especialidad] : []);
      if (nombresEspecialidades.length) {
        const especialidadRows = await Promise.all(
          nombresEspecialidades
            .map(n => n && n.trim())
            .filter(Boolean)
            .map(nombre =>
              tx.especialidad.upsert({
                where: { nombre },
                update: {},
                create: { nombre }
              })
            )
        );
        await tx.perfilabogado_especialidad.createMany({
          data: especialidadRows.map(esp => ({
            perfilabogado_id: usuarioCreated.id,
            especialidad_id: esp.id
          })),
          skipDuplicates: true
        });
      }

      // === ESTUDIO + vínculo abogadoestudio ===
      const e = abogado_info.estudio || {};
      if (Object.keys(e).length) {
        let estudioRow;
        if (e.ruc && e.ruc.trim() !== '') {
          estudioRow = await tx.estudio.upsert({
            where: { ruc: e.ruc },
            update: {
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null,
              activo: e.activo ?? false
            },
            create: {
              ruc: e.ruc,
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null,
              activo: e.activo ?? false
            }
          });
        } else {
          estudioRow = await tx.estudio.create({
            data: {
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null,
              activo: e.activo ?? false
            }
          });
        }

        await tx.abogadoestudio.create({
          data: {
            usuario_id: usuarioCreated.id,
            estudio_id: estudioRow.id,
            principal: true,
            rol_en_estudio: e.rol || null,
            activo: true
          }
        });
      }

      // === DISPONIBILIDAD ===
      const disp = (abogado_info.disponibilidad || [])
        .map(s => {
          const dia = dayNameToNum(s.dia);
          const ini = hhmmToTimeDate(s.hora_inicio);
          const fin = hhmmToTimeDate(s.hora_fin);
          if (!dia || !ini || !fin) return null;
          return { dia, ini, fin };
        })
        .filter(Boolean);

      if (disp.length) {
        await tx.disponibilidadabogado.createMany({
          data: disp.map(s => ({
            abogado_id: usuarioCreated.id,
            dia_semana: s.dia,
            hora_inicio: s.ini,
            hora_fin: s.fin
          })),
          skipDuplicates: true
        });
      }

      return tx.usuario.findUnique({
        where: { id: usuarioCreated.id },
        include: {
          persona: true,
          role: true,
          perfilabogado: {
            include: {
              disponibilidadabogado: true,
              especialidades: { include: { especialidad: true } },
              avatar: true,            }
          },
          abogadoestudios: {
            include: { estudio: { include: { direccion: true } } },
            where: { activo: true },
            orderBy: { principal: 'desc' }
          }
        }
      });
    });
    const { perfilabogado, ...rest } = result || {};
    const perfilMapped = perfilabogado ? mapPerfilResponse(perfilabogado) : null;
    if (perfilMapped) {
      perfilMapped.especialidades = (perfilabogado.especialidades || []).map(pe => pe.especialidad);
    }


    const user = result?.perfilabogado
    ? { ...rest, perfilabogado: perfilMapped }

      : result;

    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', user });
  } catch (error) {
    if (String(error.message || '').includes('ya tiene una cuenta con ese rol')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error('Error creando usuario:', error);
    res.status(500).json({ success: false, message: 'Error creando usuario' });
  }
};

// ========== Actualizar ==========
const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { persona, rol_id, abogado_info, clave } = req.body || {};
    const trimmedClave =
      clave === undefined
        ? undefined
        : (typeof clave === 'string' ? clave.trim() : String(clave || '').trim());

    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        persona: true,
        role: true,
        perfilabogado: true,
        abogadoestudios: true
      }
    });
    if (!usuarioActual) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (clave !== undefined && !trimmedClave) {
      return res.status(400).json({ success: false, message: 'La contraseña no puede estar vacía' });
    }

    // Validaciones de unicidad si cambian DNI o correo
    if (persona?.dni && persona.dni.trim() !== usuarioActual.persona.dni) {
      const dniError = await validateDni(persona.dni.trim());
      if (dniError) return res.status(400).json({ success: false, message: dniError });
      const dniExists = await prisma.persona.findUnique({ where: { dni: persona.dni.trim() } });
      if (dniExists) return res.status(400).json({ success: false, message: 'El DNI ya está registrado por otro usuario' });
    }
    if (persona?.correo && persona.correo !== usuarioActual.persona.correo) {
      const emailExists = await prisma.persona.findUnique({ where: { correo: persona.correo } });
      if (emailExists) return res.status(400).json({ success: false, message: 'El email ya está registrado por otro usuario' });
    }

    if (persona && hasOwn(persona, 'telefono')) {
      const telefonoActual = normalizeDigits(usuarioActual.persona.telefono || '');
      const telefonoNuevo = persona.telefono == null
        ? ''
        : normalizeDigits(persona.telefono);
      if (telefonoNuevo && telefonoNuevo !== telefonoActual) {
        const telefonoMatch = await prisma.$queryRaw`
          SELECT id
          FROM persona
          WHERE telefono IS NOT NULL
            AND id <> ${usuarioActual.persona_id}
            AND regexp_replace(telefono, '\\D', '', 'g') = ${telefonoNuevo}
          LIMIT 1;
        `;
        if (Array.isArray(telefonoMatch) && telefonoMatch.length > 0) {
          return res.status(400).json({ success: false, message: 'El teléfono ya está registrado por otro usuario' });
        }
      }
    }

    // Si cambian de rol, validar que no exista otro usuario de la misma persona con ese rol
    if (rol_id && parseInt(rol_id, 10) !== usuarioActual.rol_id) {
      const roleTaken = await prisma.usuario.findFirst({
        where: {
          persona_id: usuarioActual.persona_id,
          rol_id: parseInt(rol_id, 10),
          id: { not: userId }
        }
      });
      if (roleTaken) {
        return res.status(409).json({ success: false, message: 'La persona ya posee un usuario con ese rol' });
      }
    }
    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar usuario/rol
      if (rol_id && Number(rol_id) !== usuarioActual.rol_id) {
        const dup = await tx.usuario.findUnique({
          where: {
            persona_id_rol_id: {
              persona_id: usuarioActual.persona_id,
              rol_id: Number(rol_id)
            }
          }
        });
        if (dup) {
          // Lanzamos un error controlado para capturarlo fuera
          throw new Error('DUP_ROLE');
        }
      }

      if (rol_id) {
        await tx.usuario.update({
          where: { id: userId },
          data: { rol_id: parseInt(rol_id, 10) }
        });
      }

      // Actualizar persona
      if (persona) {
        const {
          dni,
          telefono,
          correo,
          primer_nombre,
          segundo_nombre,
          apellido_paterno,
          apellido_materno,
          direccion,
          direccion_id: direccionIdRaw,
          linea_exacta_direccion: lineaExactaDireccionRaw,
        } = persona;
        const personaUpdateData = {
          dni: dni ?? undefined,
          primer_nombre: primer_nombre ?? undefined,
          segundo_nombre: segundo_nombre ?? undefined,
          apellido_paterno: apellido_paterno ?? undefined,
          apellido_materno: apellido_materno ?? undefined,
        };


        if (hasOwn(persona, 'correo')) {
          const correoTrimmed = typeof correo === 'string' ? correo.trim() : correo;
          personaUpdateData.correo = correoTrimmed === '' ? null : correoTrimmed ?? null;
        }

        if (hasOwn(persona, 'telefono')) {
          if (telefono == null) {
            personaUpdateData.telefono = null;
          } else {
            const telefonoDigits = normalizeDigits(telefono);
            personaUpdateData.telefono = telefonoDigits || null;
          }
        }

        const hasLineaExacta = hasOwn(persona, 'linea_exacta_direccion') || hasOwn(persona, 'direccion');
        if (hasLineaExacta) {
          const resolvedLineaExacta = hasOwn(persona, 'linea_exacta_direccion')
            ? normalizeOptionalStringInput(lineaExactaDireccionRaw)
            : normalizeOptionalStringInput(direccion);
          personaUpdateData.linea_exacta_direccion = resolvedLineaExacta;
        }

        if (hasOwn(persona, 'direccion_id')) {
          personaUpdateData.direccion_id = normalizeOptionalStringInput(direccionIdRaw);
        }
        await tx.persona.update({
          where: { id: usuarioActual.persona_id },
          data: personaUpdateData
        });
      }

      if (trimmedClave !== undefined && trimmedClave !== usuarioActual.clave) {
        await tx.usuario.update({
          where: { id: userId },
          data: { clave: trimmedClave },
        });
      }

      // Rol final (si no enviaron, usa el actual)
      const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id || usuarioActual.rol_id, 10) } });
      const isAbogado = rol?.codigo === 'abogado';

      if (isAbogado && abogado_info) {
        const avatarArchivoRaw = abogado_info.avatarArchivo ?? abogado_info.avatar_archivo ?? null;
        const avatarArchivoIdRaw = abogado_info.avatar_archivo_id ?? abogado_info.avatarArchivoId;
        const avatarIdProvided = hasOwn(abogado_info, 'avatar_archivo_id') || hasOwn(abogado_info, 'avatarArchivoId') || hasOwn(abogado_info, 'avatarArchivo');
        const parsedAvatarId = avatarIdProvided ? parseAvatarId(avatarArchivoIdRaw) : undefined;
        const { avatarId, shouldCleanup } = await resolveAvatarArchivo(tx, userId, avatarArchivoRaw, parsedAvatarId, avatarIdProvided);        // Upsert perfil (sin columnas inexistentes)
        await tx.perfilabogado.upsert({
          
          where: { usuario_id: userId },
          update: {
            tarifa_base: abogado_info.tarifabase ?? null,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null,
            place_id_api: abogado_info.placeIdApi || null,
            ...(avatarId !== undefined ? { avatar_archivo_id: avatarId } : {}),          },
          create: {
            usuario_id: userId,
            tarifa_base: abogado_info.tarifabase ?? null,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null,
            place_id_api: abogado_info.placeIdApi || null,
            avatar_archivo_id: avatarId ?? null,          }
        });
        if (shouldCleanup) {
          await cleanupOldAvatarArchivos(tx, userId, avatarId ?? null);
        }

        // Especialidades (sync)
        await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: userId } });
        const nombresEspecialidades = Array.isArray(abogado_info.especialidades)
          ? abogado_info.especialidades
          : (abogado_info.especialidad ? [abogado_info.especialidad] : []);
        if (nombresEspecialidades.length) {
          const especialidadRows = await Promise.all(
            nombresEspecialidades
              .map(n => n && n.trim())
              .filter(Boolean)
              .map(nombre =>
                tx.especialidad.upsert({
                  where: { nombre },
                  update: {},
                  create: { nombre }
                })
              )
          );
          await tx.perfilabogado_especialidad.createMany({
            data: especialidadRows.map(esp => ({
              perfilabogado_id: userId,
              especialidad_id: esp.id
            })),
            skipDuplicates: true
          });
        }

        // Estudio (vínculo abogadoestudio)
        const e = abogado_info.estudio || {};
        if (Object.keys(e).length) {
          let estudioRow;
          if (e.ruc && e.ruc.trim() !== '') {
            estudioRow = await tx.estudio.upsert({
              where: { ruc: e.ruc },
              update: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              },
              create: {
                ruc: e.ruc,
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          } else if (usuarioActual.abogadoestudios?.[0]) {
            estudioRow = await tx.estudio.update({
              where: { id: usuarioActual.abogadoestudios[0].estudio_id },
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          } else {
            estudioRow = await tx.estudio.create({
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          }

          await tx.abogadoestudio.deleteMany({ where: { usuario_id: userId } });
          await tx.abogadoestudio.create({
            data: {
              usuario_id: userId,
              estudio_id: estudioRow.id,
              principal: true,
              rol_en_estudio: e.rol || null,
              activo: true
            }
          });
        }

        // Reemplazar disponibilidad
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
        const disp = (abogado_info.disponibilidad || [])
          .map(s => {
            const dia = dayNameToNum(s.dia);
            const ini = hhmmToTimeDate(s.hora_inicio);
            const fin = hhmmToTimeDate(s.hora_fin);
            if (!dia || !ini || !fin) return null;
            return { dia, ini, fin };
          })
          .filter(Boolean);

        if (disp.length) {
          await tx.disponibilidadabogado.createMany({
            data: disp.map(s => ({
              abogado_id: userId,
              dia_semana: s.dia,
              hora_inicio: s.ini,
              hora_fin: s.fin
            })),
            skipDuplicates: true
          });
        }
      } else {
        // Si dejó de ser abogado: limpia perfil, especialidades, disponibilidad y estudios
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
        await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: userId } });
        await tx.abogadoestudio.updateMany({
          where: { usuario_id: userId },
          data: { activo: false, principal: false }
        });
        if (usuarioActual.perfilabogado) {
          await tx.perfilabogado.delete({ where: { usuario_id: userId } });
        }
      }

      return tx.usuario.findUnique({
        where: { id: userId },
        include: {
          persona: true,
          role: true,
          perfilabogado: {
            include: {
              disponibilidadabogado: true,
              especialidades: { include: { especialidad: true } },
              avatar: true,            }
          },
          abogadoestudios: {
            include: { estudio: { include: { direccion: true } } },
            where: { activo: true },
            orderBy: { principal: 'desc' }
          }
        }
      });
    });
    
    const { perfilabogado, ...rest } = updated || {};
    const perfilMapped = perfilabogado ? mapPerfilResponse(perfilabogado) : null;
    if (perfilMapped) {
      perfilMapped.especialidades = (perfilabogado.especialidades || []).map(pe => pe.especialidad);
    }

    const user = { ...rest, perfilabogado: perfilMapped };


    res.json({ success: true, message: 'Usuario actualizado exitosamente', user });
  } catch (error) {
    if (error?.message === 'DUP_ROLE') {
      return res.status(409).json({ success: false, message: 'La persona ya tiene ese rol' });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ success: false, message: 'Error actualizando usuario' });
  }
};
// ========== Eliminar ==========
const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        role: true,
        persona: { include: { verificacionabogado: true } },
        perfilabogado: true,
        abogadoestudios: true,
      }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });


    const roleCode = (usuario.role?.codigo || '').toLowerCase();
    if (roleCode === 'abogado') {
      return res.status(409).json({ success: false, message: 'No se puede eliminar una cuenta con rol de abogado' });
    }

    if (usuario.persona?.verificacionabogado) {
      return res.status(409).json({ success: false, message: 'No se puede eliminar a un cliente que registró una verificación de abogado' });
    }

    const linkedLawyerAccount = await prisma.usuario.findFirst({
      where: {
        persona_id: usuario.persona_id,
        id: { not: usuario.id },
        role: { codigo: { equals: 'abogado', mode: 'insensitive' } },
      },
    });
    if (linkedLawyerAccount) {
      return res.status(409).json({ success: false, message: 'No se puede eliminar a un cliente que cuenta con usuarios de abogado asociados' });
    }


    await prisma.$transaction(async (tx) => {
      // Si es abogado, limpia dependencias manuales
      if (usuario.perfilabogado) {
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: id } });
        await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: id } });
        await tx.perfilabogado.delete({ where: { usuario_id: id } });
      }
      // Desactiva vínculos con estudios
      await tx.abogadoestudio.deleteMany({ where: { usuario_id: id } });

      // Borrar el usuario
      await tx.usuario.delete({ where: { id } });

      // 🔑 Aquí va el cambio:
      const remaining = await tx.usuario.count({ where: { persona_id: usuario.persona_id } });
      if (remaining === 0) {
        await tx.persona.delete({ where: { id: usuario.persona_id } });
      }
    });

    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ success: false, message: 'Error eliminando usuario' });
  }
};



const setUserActive = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const { activo } = req.body || {};
    if (activo !== false) {
      return res.status(400).json({ success: false, message: 'Solo se permite deshabilitar la cuenta de abogado.' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const roleCode = (usuario.role?.codigo || '').toLowerCase();
    if (roleCode !== 'abogado') {
      return res.status(409).json({ success: false, message: 'Solo se pueden deshabilitar cuentas con rol de abogado.' });
    }

    if (!usuario.activo) {
      return res.json({
        success: true,
        user: { id: usuario.id, persona_id: usuario.persona_id, rol_id: usuario.rol_id, activo: usuario.activo },
      });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });

    return res.json({
      success: true,
      user: { id: updated.id, persona_id: updated.persona_id, rol_id: updated.rol_id, activo: updated.activo },
    });
  } catch (error) {
    console.error('Error actualizando estado del usuario:', error);
    return res.status(500).json({ success: false, message: 'Error actualizando estado del usuario' });
  }
};

// ======== Perfil de abogado =========
const getUserPerfil = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    const perfil = await prisma.perfilabogado.findUnique({
      where: { usuario_id: userId },
      include: { avatar: true },
    });
    if (!perfil) return res.status(404).json({ message: 'Perfil de abogado no encontrado' });
    res.json(mapPerfilResponse(perfil));
  } catch (error) {
    console.error('Error obteniendo perfil de abogado:', error);
    res.status(500).json({ message: 'Error obteniendo perfil de abogado' });
  }
};

const updateUserPerfil = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    const body = req.body || {};
    const {
      tarifa_base,
      direccion_atencion,
      bio,
    } = body;

    const avatarArchivoRaw = body.avatarArchivo ?? body.avatar_archivo ?? null;
    const avatarArchivoIdRaw = body.avatar_archivo_id ?? body.avatarArchivoId;
    const avatarIdProvided = hasOwn(body, 'avatar_archivo_id') || hasOwn(body, 'avatarArchivoId');

    const perfil = await prisma.$transaction(async (tx) => {
      const parsedAvatarId = avatarIdProvided ? parseAvatarId(avatarArchivoIdRaw) : undefined;
      const { avatarId, shouldCleanup } = await resolveAvatarArchivo(
        tx,
        userId,
        avatarArchivoRaw,
        parsedAvatarId,
        avatarIdProvided,
      );
      const updateData = {
        tarifa_base: tarifa_base ?? null,
        direccion_atencion: direccion_atencion ?? null,
        bio: bio ?? null,
        avatar_archivo_id: avatarId ?? null,
      };
      const createData = {
        ...updateData,
        usuario_id: userId,
      };
      const perfil = await tx.perfilabogado.upsert({
        where: { usuario_id: userId },
        update: updateData,
        create: createData,
        include: { avatar: true },
      });
      if (shouldCleanup) {
        await cleanupOldAvatarArchivos(tx, userId, avatarId ?? null);
      }

      return perfil;
    });

    res.json({ success: true, perfil: mapPerfilResponse(perfil) });
  } catch (error) {
    console.error('Error guardando perfil de abogado:', error);
    const status = error.statusCode || 500;
    res
    .status(status)
    .json({ message: error.message || 'Error guardando perfil de abogado' });
}};

const getUserEspecialidades = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const perfil = await prisma.perfilabogado.findUnique({
      where: { usuario_id: userId },
      include: {
        especialidades: { include: { especialidad: true  } }
      }
    });
    if (!perfil) return res.json([]);
    const list = perfil.especialidades.map(pe => ({
      id: pe.especialidad.id,
      nombre: pe.especialidad.nombre
    }));
    res.json(list);
  } catch (error) {
    console.error('Error obteniendo especialidades de usuario:', error);
    res.status(500).json({ message: 'Error obteniendo especialidades' });
  }
};

const updateUserEspecialidades = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
    : [];
  try {
    await prisma.$transaction(async (tx) => {
      const perfil = await tx.perfilabogado.findUnique({ where: { usuario_id: userId } });
      if (!perfil) throw new Error('Perfil de abogado no encontrado');
      await syncPerfilEspecialidades(tx, userId, ids);
    });
    res.json({ success: true, ids });
  } catch (error) {
    console.error('Error actualizando especialidades:', error);
    res.status(500).json({ message: error.message || 'Error actualizando especialidades' });
  }
};

// ======== Estudios por usuario =========
const getUserEstudios = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const rows = await prisma.abogadoestudio.findMany({
      where: { usuario_id: userId, activo: true },
      include: { estudio: { include: { direccion: true } } },
      orderBy: { principal: 'desc' }
    });
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo estudios del usuario:', error);
    res.status(500).json({ message: 'Error obteniendo estudios' });
  }
};

const upsertUserEstudio = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  let {
    estudio_id,
    principal,
    rol_en_estudio,
    direccion_id: direccionIdRaw,
    linea_exacta_direccion: lineaExactaRaw,
  } = req.body || {};
  estudio_id = parseInt(estudio_id, 10);
  principal = !!principal;
  const direccionId = sanitizeString(direccionIdRaw);
  const lineaExactaDireccion = sanitizeString(lineaExactaRaw);

  if (!direccionId) {
    return res.status(400).json({ message: 'El campo direccion_id es obligatorio.' });
  }

  if (direccionId.length !== 6) {
    return res.status(400).json({ message: 'El código de dirección debe tener 6 caracteres.' });
  }

  if (!lineaExactaDireccion) {
    return res.status(400).json({ message: 'La dirección exacta es obligatoria.' });
  }
  try {
    const direccion = await prisma.direccion.findUnique({
      where: { ubigeo_codigo: direccionId },
    });

    if (!direccion) {
      return res.status(400).json({ message: 'La dirección seleccionada no existe.' });
    }
    const vinculo = await prisma.$transaction(async (tx) => {
      const row = await tx.abogadoestudio.upsert({
        where: { usuario_id_estudio_id: { usuario_id: userId, estudio_id } },
        update: { principal, rol_en_estudio, activo: true },
        create: { usuario_id: userId, estudio_id, principal, rol_en_estudio },
        include: { estudio: { include: { direccion: true } } }
      });

      const estudioActualizado = await tx.estudio.update({
        where: { id: estudio_id },
        data: {
          direccion_id: direccionId,
          linea_exacta_direccion: lineaExactaDireccion,
        },
        include: { direccion: true },
      });

      if (principal) {
        await tx.abogadoestudio.updateMany({
          where: { usuario_id: userId, estudio_id: { not: estudio_id } },
          data: { principal: false }
        });
      }
      return { ...row, estudio: estudioActualizado };
    });
    res.json({ success: true, vinculo });
  } catch (error) {
    console.error('Error guardando estudio del usuario:', error);
    res.status(500).json({ message: 'Error guardando estudio del usuario' });
  }
};

const deleteUserEstudio = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const estudioId = parseInt(req.params.estudioId, 10);

    if (Number.isNaN(userId) || Number.isNaN(estudioId)) {
      return res.status(400).json({ message: 'Parámetros inválidos' });
    }

    const result = await prisma.abogadoestudio.updateMany({
      where: { usuario_id: userId, estudio_id: estudioId, activo: true },
      data: { activo: false, principal: false },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: 'Vínculo con estudio no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error desactivando estudio del usuario:', error);
    res.status(500).json({ message: 'Error desactivando estudio del usuario' });
  }
};

// ======== Disponibilidad de abogado =========
const getUserDisponibilidad = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const slots = await prisma.disponibilidadabogado.findMany({
      where: { abogado_id: userId },
      orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }]
    });
    res.json(slots);
  } catch (error) {
    console.error('Error obteniendo disponibilidad del usuario:', error);
    res.status(500).json({ message: 'Error obteniendo disponibilidad del usuario' });
  }
};

const addUserDisponibilidad = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { dia_semana, hora_inicio, hora_fin } = req.body || {};
    const dia = parseInt(dia_semana, 10);
    const ini = hhmmToTimeDate(hora_inicio);
    const fin = hhmmToTimeDate(hora_fin);
    if (!dia || !ini || !fin) {
      return res.status(400).json({ message: 'Datos de disponibilidad inválidos' });
    }
    // asegurarnos de que el usuario tenga perfil de abogado
    const perfil = await prisma.perfilabogado.findUnique({ where: { usuario_id: userId } });
    if (!perfil) {
      return res.status(404).json({ message: 'El usuario no tiene perfil de abogado' });
    }
    const slot = await prisma.disponibilidadabogado.create({
      data: {
        abogado_id: userId,
        dia_semana: dia,
        hora_inicio: ini,
        hora_fin: fin
      }
    });
    res.status(201).json({ success: true, slot });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Horario ya registrado' });
    }
    console.error('Error guardando disponibilidad del usuario:', error);
    res.status(500).json({ message: 'Error guardando disponibilidad del usuario' });
  }
};

const deleteUserDisponibilidad = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const slotId = parseInt(req.params.slotId, 10);
    const result = await prisma.disponibilidadabogado.deleteMany({
      where: { id: slotId, abogado_id: userId }
    });
    if (result.count === 0) {
      return res.status(404).json({ message: 'Horario no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando disponibilidad del usuario:', error);
    res.status(500).json({ message: 'Error eliminando disponibilidad del usuario' });
  }
};

module.exports = {
  // listados
  getAllUsers,
  getUserById,
  getRoles,
  // CRUD
  createUser,
  updateUser,
  deleteUser,
  setUserActive,
  getUserPerfil,
  updateUserPerfil,
  getUserEspecialidades,
  updateUserEspecialidades,
  getUserEstudios,
  upsertUserEstudio,
  deleteUserEstudio,
  getUserDisponibilidad,
  addUserDisponibilidad,
  deleteUserDisponibilidad,
  // auxiliares
  checkPersonaConflicts,
  lookupDni,
  fetchDniInfo,
  // públicos abogado
  searchPublicLawyers,
  getPublicLawyerProfile,
  getLawyerAvailabilityWithBookings,
  listLawyerLocations,

};
