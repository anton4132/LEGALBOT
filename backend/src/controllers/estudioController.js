const { prisma } = require('../config/database');

const sanitizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return null;
    return ['SI', 'S', 'TRUE', '1', 'ACTIVO'].includes(normalized);
  }
  return null;
};

const mapEstudioResponse = (estudio) => {
  if (!estudio) return estudio;
  const { direccion, ...rest } = estudio;
  const direccionData = direccion || {};
  const direccionUbigeoCodigo =
    sanitizeString(rest.direccion_id) ||
    sanitizeString(direccionData.ubigeo_codigo);

  const nombreComercial =
    sanitizeString(rest.nombre_comercial) ||
    sanitizeString(rest.nombre_o_razon_social) ||
    null;

  const direccionExacta =
    sanitizeString(rest.linea_exacta_direccion) ||
    sanitizeString(rest.direccion_exacta) ||
    null;

  return {
    ...rest,
    nombre_comercial: nombreComercial,
    nombre_o_razon_social:
      sanitizeString(rest.nombre_o_razon_social) || nombreComercial,
    direccion,
    direccion_ubigeo_codigo: direccionUbigeoCodigo,
    linea_exacta_direccion: direccionExacta,
    departamento:
      sanitizeString(rest.departamento) ||
      sanitizeString(direccionData.departamento) ||
      null,
    provincia:
      sanitizeString(rest.provincia) ||
      sanitizeString(direccionData.provincia) ||
      null,
    distrito:
      sanitizeString(rest.distrito) ||
      sanitizeString(direccionData.distrito) ||
      null,
    es_agente_retencion:
      rest.es_agente_retencion !== undefined
        ? !!rest.es_agente_retencion
        : null,
    es_agente_percepcion:
      rest.es_agente_percepcion !== undefined
        ? !!rest.es_agente_percepcion
        : null,
    es_agente_percepcion_combustible:
      rest.es_agente_percepcion_combustible !== undefined
        ? !!rest.es_agente_percepcion_combustible
        : null,
    es_buen_contribuyente:
      rest.es_buen_contribuyente !== undefined
        ? !!rest.es_buen_contribuyente
        : null,
  };
};


const normalizeUbigeoCodigo = (value) => {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return { code: null, originalLength: 0 };
  }

  const digitsOnly = sanitized.replace(/\D/g, '');
  if (!digitsOnly) {
    return { code: null, originalLength: 0 };
  }

  if (digitsOnly.length === 6) {
    return { code: digitsOnly, originalLength: 6 };
  }

  if (digitsOnly.length === 4) {
    return { code: `${digitsOnly}00`, originalLength: 4 };
  }

  return { code: null, originalLength: digitsOnly.length };
};


const fetchRucInfo = async (ruc) => {
  const token = sanitizeString(process.env.APIPERU_TOKEN);
  if (!token) {
    throw new Error('Servicio de consulta RUC no configurado.');
  }

  const response = await fetch('https://apiperu.dev/api/ruc', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ruc }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message || payload?.error || 'Error consultando servicio de RUC';
    throw new Error(message);
  }

  if (!payload?.success) {
    const message =
      payload?.message || 'No se encontró información para el RUC ingresado';
    throw new Error(message);
  }

  const data = payload.data || {};
  if (!data.ruc) {
    throw new Error('La respuesta del servicio de RUC es inválida.');
  }

  return data;
};

const searchEstudios = async (req, res) => {
  try {
    const term = String(req.query.search || '').trim();
    if (!term) return res.json([]);
    const rows = await prisma.estudio.findMany({
      where: {
        OR: [
          { ruc: { contains: term } },
          { nombre_comercial: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { nombre_comercial: 'asc' },
      take: 10,
      include: {
        direccion: true,
      },
    });
    res.json(rows.map(mapEstudioResponse));
  } catch (error) {
    console.error('Error buscando estudios:', error);
    res.status(500).json({ message: 'Error buscando estudios' });
  }
};

const createEstudio = async (req, res) => {
  try {
    const data = req.body || {};
    const direccionId =
      sanitizeString(data.direccion_id) ||
      sanitizeString(data.direccionUbigeoCodigo);
    const lineaExacta = sanitizeString(data.linea_exacta_direccion);

    if (!direccionId) {
      return res
        .status(400)
        .json({ message: 'El campo direccion_id es obligatorio.' });
    }

    if (!lineaExacta) {
      return res
        .status(400)
        .json({ message: 'La dirección exacta es obligatoria.' });
    }

    const created = await prisma.estudio.create({
      data: {
        ruc: sanitizeString(data.ruc),
        nombre_comercial: sanitizeString(data.nombre_comercial),
        correo_contacto: sanitizeString(data.correo_contacto),
        telefono: sanitizeString(data.telefono),
        direccion_id: direccionId,
        linea_exacta_direccion: lineaExacta,
        activo: false,
      },
      include: {
        direccion: true,
      },
    });
    res.status(201).json(mapEstudioResponse(created));
  } catch (error) {
    console.error('Error creando estudio:', error);
    res.status(500).json({ message: 'Error creando estudio' });
  }
};

const lookupEstudioPorRuc = async (req, res) => {
  try {
    const ruc = sanitizeString(req.body?.ruc);
    if (!ruc) {
      return res
        .status(400)
        .json({ success: false, message: 'El RUC es obligatorio.' });
    }

    if (!/^\d{11}$/.test(ruc)) {
      return res.status(400).json({
        success: false,
        message: 'El RUC debe tener 11 dígitos numéricos.',
      });
    }

    const apiData = await fetchRucInfo(ruc);

    const { code: ubigeoSunat, originalLength: ubigeoLength } =
      normalizeUbigeoCodigo(apiData.ubigeo_sunat);
    if (!ubigeoSunat) {
      return res.status(400).json({
        success: false,
        message:
          ubigeoLength < 4
            ? 'Este RUC no tiene una dirección válida.'
            : 'El servicio de RUC no devolvió un código de ubigeo válido (6 dígitos).',
      });
    }

    const direccionDepartamento = sanitizeString(apiData.departamento);
    const direccionProvincia = sanitizeString(apiData.provincia);
    const direccionDistrito = sanitizeString(apiData.distrito);

    if (!direccionDepartamento || !direccionProvincia) {
      return res.status(400).json({
        success: false,
        message:
          'El servicio de RUC no devolvió una dirección completa para registrar.',
      });
    }

    const distritoNormalizado =
      direccionDistrito || (ubigeoLength === 4 ? 'Sin distrito' : null);

    if (!distritoNormalizado) {
      return res.status(400).json({
        success: false,
        message:
          'El servicio de RUC no devolvió una dirección completa para registrar.',
      });
    }

   const nombreComercialSunat = sanitizeString(apiData.nombre_comercial);
    const nombreRazonSocial =
      sanitizeString(apiData.nombre_o_razon_social) || nombreComercialSunat;
          
    const direccionExacta =
      sanitizeString(apiData.direccion_completa) ||
      sanitizeString(apiData.direccion);

    const estado = sanitizeString(apiData.estado);
    const condicion = sanitizeString(apiData.condicion);

    const estudio = await prisma.$transaction(async (tx) => {
      let direccion = await tx.direccion.findUnique({
        where: { ubigeo_codigo: ubigeoSunat },
      });

      if (!direccion) {
        direccion = await tx.direccion.create({
          data: {
            ubigeo_codigo: ubigeoSunat,
            departamento: direccionDepartamento,
            provincia: direccionProvincia,
            distrito: distritoNormalizado,
          },
        });
      }

      const estudioData = {
        nombre_comercial: nombreComercialSunat || nombreRazonSocial,
        nombre_o_razon_social: nombreRazonSocial,
        direccion_id: direccion.ubigeo_codigo,
        direccion_exacta: direccionExacta,
        estado,
        condicion,
        es_agente_retencion: normalizeFlag(apiData.es_agente_de_retencion),
        es_agente_percepcion: normalizeFlag(apiData.es_agente_de_percepcion),
        es_agente_percepcion_combustible: normalizeFlag(
          apiData.es_agente_de_percepcion_combustible,
        ),
        es_buen_contribuyente: normalizeFlag(apiData.es_buen_contribuyente),
      };

      const upserted = await tx.estudio.upsert({
        where: { ruc },
        update: {
          ...estudioData,
          actualizado_el: new Date(),
        },
        create: {
          ruc,
          ...estudioData,
        },
        include: { direccion: true },
      });

      return upserted;
    });

    return res.json({ success: true, data: mapEstudioResponse(estudio) });
  } catch (error) {
    console.error('Error consultando RUC de estudio:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error consultando RUC de estudio',
    });
  }
};

module.exports = { searchEstudios, createEstudio, lookupEstudioPorRuc };