const { prisma } = require('../config/database');

function sanitizeCodigo(raw, expectedLength) {
  if (raw == null) return null;
  const digits = String(raw).trim().replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < expectedLength) {
    return digits.padStart(expectedLength, '0');
  }
  if (digits.length > expectedLength) {
    return digits.slice(0, expectedLength);
  }
  return digits;
}

function mapRows(rows) {
  return rows
    .map((row) => ({
      codigo: sanitizeCodigo(row.codigo, 2),
      nombre: row.nombre ? String(row.nombre).trim() : null,
    }))
    .filter((row) => row.codigo && row.nombre);
}
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

let departamentosCache = null;
let departamentosCacheExpiration = 0;
const provinciasCache = new Map();
const distritosCache = new Map();

const EMPTY_WARNINGS = {
  departamentos: 'No se encontraron departamentos en el catálogo de direcciones. Carga los datos antes de continuar.',
  provincias: 'No hay provincias disponibles para el departamento seleccionado.',
  distritos: 'No hay distritos disponibles para la provincia seleccionada.',
};

function buildResponsePayload(data, warningKey) {
  const list = Array.isArray(data) ? data : [];
  const payload = { success: true, data: list };
  if (!list.length && warningKey && EMPTY_WARNINGS[warningKey]) {
    payload.warning = EMPTY_WARNINGS[warningKey];
  }
  return payload;
}

function respondWithData(res, data, warningKey) {
  res.json(buildResponsePayload(data, warningKey));
}

function isCacheValid(expiration) {
  return expiration !== 0 && Date.now() < expiration;
}

function getCacheEntry(cacheMap, key) {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (!isCacheValid(entry.expires)) {
    cacheMap.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEntry(cacheMap, key, value) {
  cacheMap.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

async function listDepartamentos(req, res, next) {
  try {
    if (isCacheValid(departamentosCacheExpiration) && departamentosCache) {
      return respondWithData(res, departamentosCache, 'departamentos');
    }
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT LEFT(ubigeo_codigo, 2) AS codigo, departamento AS nombre
      FROM direccion
      WHERE departamento <> ''
      ORDER BY nombre ASC
    `;

    const data = mapRows(rows).map((row) => ({
      codigo: row.codigo,
      nombre: row.nombre,
    }));
    departamentosCache = data;
    departamentosCacheExpiration = Date.now() + CACHE_TTL_MS;

    respondWithData(res, data, 'departamentos');
  } catch (error) {
    next(error);
  }
}

async function listProvincias(req, res, next) {
  try {
    const departamentoCodigo = sanitizeCodigo(req.params.departamentoCodigo, 2);
    if (!departamentoCodigo) {
      return res
        .status(400)
        .json({ success: false, message: 'Código de departamento inválido' });
    }

    const cached = getCacheEntry(provinciasCache, departamentoCodigo);
    if (cached) {
      return respondWithData(res, cached, 'provincias');
    }

    const rows = await prisma.$queryRaw`
      SELECT DISTINCT LEFT(ubigeo_codigo, 4) AS codigo, provincia AS nombre
      FROM direccion
      WHERE LEFT(ubigeo_codigo, 2) = ${departamentoCodigo}
        AND provincia <> ''
      ORDER BY nombre ASC
    `;

    const data = rows
      .map((row) => ({
        codigo: sanitizeCodigo(row.codigo, 4),
        nombre: row.nombre ? String(row.nombre).trim() : null,
      }))
      .filter((row) => row.codigo && row.nombre);

    setCacheEntry(provinciasCache, departamentoCodigo, data);
    respondWithData(res, data, 'provincias');
  } catch (error) {
    next(error);
  }
}

async function listDistritos(req, res, next) {
  try {
    const provinciaCodigo = sanitizeCodigo(req.params.provinciaCodigo, 4);
    if (!provinciaCodigo) {
      return res
        .status(400)
        .json({ success: false, message: 'Código de provincia inválido' });
    }
    const cached = getCacheEntry(distritosCache, provinciaCodigo);
    if (cached) {
      return respondWithData(res, cached, 'distritos');
    }
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ubigeo_codigo AS codigo, distrito AS nombre
      FROM direccion
      WHERE LEFT(ubigeo_codigo, 4) = ${provinciaCodigo}
        AND distrito <> ''
      ORDER BY nombre ASC
    `;

    const data = rows
      .map((row) => ({
        codigo: sanitizeCodigo(row.codigo, 6),
        nombre: row.nombre ? String(row.nombre).trim() : null,
      }))
      .filter((row) => row.codigo && row.nombre);
    setCacheEntry(distritosCache, provinciaCodigo, data);

    respondWithData(res, data, 'distritos');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDepartamentos,
  listProvincias,
  listDistritos,
};