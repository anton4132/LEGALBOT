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

async function listDepartamentos(req, res, next) {
  try {
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

    res.json(data);
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

    res.json(data);
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

    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDepartamentos,
  listProvincias,
  listDistritos,
};