const { prisma } = require('../config/database');
const {
  parseIntOrNull,
  parseDate,
  toDecimal,
  decimalToNumber,
  collectConflictIds,
  buildOverlapWhere,
} = require('./helpers/ruleUtils');

const COMISION_SCOPE_FIELDS = ['servicio_id', 'plan_id', 'rol_aplica'];

function serializeComision(comision) {
  if (!comision) return null;
  const vigenciaDesde = comision.vigencia_desde
    ? comision.vigencia_desde.toISOString().slice(0, 10)
    : null;
  const vigenciaHasta = comision.vigencia_hasta
    ? comision.vigencia_hasta.toISOString().slice(0, 10)
    : null;
  const actualizado = comision.actualizado_el
    ? comision.actualizado_el.toISOString()
    : null;
  const creado = comision.creado_el ? comision.creado_el.toISOString() : null;
  return {
    id: comision.id,
    descripcion: comision.descripcion,
    rol_aplica: comision.rol_aplica,
    porcentaje: decimalToNumber(comision.porcentaje),
    servicio_id: comision.servicio_id,
    servicio: comision.servicio || null,
    plan_id: comision.plan_id,
    plan: comision.plan || null,
    activo: comision.activo,
    vigencia_desde: vigenciaDesde,
    vigencia_hasta: vigenciaHasta,
    creado_el: creado,
    actualizado_el: actualizado,
  };
}

function mapComisionData(payload) {
  const data = {
    descripcion: payload.descripcion?.trim() || null,
    rol_aplica: payload.rol_aplica?.trim() || null,
    porcentaje: toDecimal(payload.porcentaje),
    servicio_id: parseIntOrNull(payload.servicio_id),
    plan_id: parseIntOrNull(payload.plan_id),
    vigencia_desde: parseDate(payload.vigencia_desde),
    vigencia_hasta: parseDate(payload.vigencia_hasta),
    activo: payload.activo === undefined ? true : !!payload.activo,
  };
  return data;
}

function mapComisionPatch(payload) {
  const data = {};
  if (!payload || typeof payload !== 'object') {
    return data;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'descripcion')) {
    data.descripcion = payload.descripcion?.trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'rol_aplica')) {
    data.rol_aplica = payload.rol_aplica?.trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'porcentaje')) {
    data.porcentaje = toDecimal(payload.porcentaje);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'activo')) {
    data.activo = !!payload.activo;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'vigencia_desde')) {
    data.vigencia_desde = parseDate(payload.vigencia_desde);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'vigencia_hasta')) {
    data.vigencia_hasta = parseDate(payload.vigencia_hasta);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'servicio_id')) {
    data.servicio_id = parseIntOrNull(payload.servicio_id);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'plan_id')) {
    data.plan_id = parseIntOrNull(payload.plan_id);
  }
  return data;
}

function ensureRequiredFields(data) {
  if (!data.rol_aplica) {
    const error = new Error('El rol aplica es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  if (data.porcentaje === null || data.porcentaje === undefined) {
    const error = new Error('El porcentaje es obligatorio');
    error.statusCode = 400;
    throw error;
  }
}

function buildListWhere(query) {
  const where = {};
  const servicioId = parseIntOrNull(query.servicio_id);
  const planId = parseIntOrNull(query.plan_id);
  const rol = query.rol_aplica?.trim();
  const estado = query.activo?.trim();
  const fecha = parseDate(query.fecha);
  const vigencia = query.vigencia?.trim();
  const search = query.search?.trim();
  const andClauses = [];

  if (servicioId !== null) {
    where.servicio_id = servicioId;
  }
  if (planId !== null) {
    where.plan_id = planId;
  }
  if (rol) {
    where.rol_aplica = rol;
  }
  if (estado === 'true' || estado === 'false') {
    where.activo = estado === 'true';
  }
  if (fecha) {
    andClauses.push({
      OR: [
        { vigencia_desde: null },
        { vigencia_desde: { lte: fecha } },
      ],
    });
    andClauses.push({
      OR: [
        { vigencia_hasta: null },
        { vigencia_hasta: { gte: fecha } },
      ],
    });
  }
  if (vigencia) {
    const reference = fecha || (() => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now;
    })();
    if (vigencia === 'vigentes') {
      andClauses.push({
        OR: [
          { vigencia_desde: null },
          { vigencia_desde: { lte: reference } },
        ],
      });
      andClauses.push({
        OR: [
          { vigencia_hasta: null },
          { vigencia_hasta: { gte: reference } },
        ],
      });
    } else if (vigencia === 'futuras') {
      andClauses.push({
        vigencia_desde: { gt: reference },
      });
    } else if (vigencia === 'vencidas') {
      andClauses.push({
        vigencia_hasta: { lt: reference },
      });
    }
  }
  if (search) {
    const parsedId = parseIntOrNull(search);
    const orClauses = [{ descripcion: { contains: search, mode: 'insensitive' } }];
    if (parsedId !== null) {
      orClauses.push({ id: parsedId });
    }
    andClauses.push({ OR: orClauses });
  }
  if (andClauses.length) {
    where.AND = andClauses;
  }
  return where;
}

function buildComisionOverlapWhere(data, excludeId) {
  return buildOverlapWhere(data, COMISION_SCOPE_FIELDS, excludeId);
}

async function findConflicts(data, excludeId) {
  if (data.activo === false) return [];
  const where = buildComisionOverlapWhere(data, excludeId);
  const overlaps = await prisma.comision.findMany({
    where,
    include: {
      servicio: { select: { id: true, nombre: true, codigo: true } },
      plan: { select: { id: true, nombre: true } },
    },
  });
  return overlaps.map((item) => serializeComision(item));
}

async function getComisiones(req, res) {
  try {
    const page = parseIntOrNull(req.query.page) || 1;
    const perPage = parseIntOrNull(req.query.per_page) || 20;
    const where = buildListWhere(req.query);
    let filteredWhere = { ...where };
    if (req.query.conflictos === 'true') {
      const scopeCandidates = await prisma.comision.findMany({
        where,
        select: {
          id: true,
          servicio_id: true,
          plan_id: true,
          rol_aplica: true,
          vigencia_desde: true,
          vigencia_hasta: true,
          activo: true,
        },
      });
      const conflictIds = collectConflictIds(scopeCandidates, COMISION_SCOPE_FIELDS);
      if (!conflictIds.length) {
        return res.json({ items: [], total: 0, page: 1, perPage });
      }
      filteredWhere = {
        ...where,
        id: { in: conflictIds },
      };
    }
    const [items, total] = await Promise.all([
      prisma.comision.findMany({
        where: filteredWhere,
        include: {
          servicio: { select: { id: true, codigo: true, nombre: true } },
          plan: { select: { id: true, nombre: true } },
        },
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.comision.count({ where: filteredWhere }),
    ]);
    res.json({
      items: items.map((item) => serializeComision(item)),
      total,
      page,
      perPage,
    });
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo comisiones' });
  }
}

async function getComision(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const comision = await prisma.comision.findUnique({
      where: { id },
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    if (!comision) {
      return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    }
    res.json(serializeComision(comision));
  } catch (error) {
    console.error('Error obteniendo comisión:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo comisión' });
  }
}

async function createComision(req, res) {
  try {
    const data = mapComisionData(req.body);
    ensureRequiredFields(data);
    const conflicts = await findConflicts(data);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La nueva comisión entra en conflicto con comisiones existentes',
        conflicts,
      });
    }
    const created = await prisma.comision.create({
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json({ success: true, comision: serializeComision(created) });
  } catch (error) {
    console.error('Error creando comisión:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'La combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error creando comisión' });
  }
}

async function updateComision(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const previous = await prisma.comision.findUnique({ where: { id } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    }
    const data = mapComisionData(req.body);
    ensureRequiredFields(data);
    const conflicts = await findConflicts({ ...previous, ...data }, id);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La comisión actualizada entra en conflicto con comisiones existentes',
        conflicts,
      });
    }
    const updated = await prisma.comision.update({
      where: { id },
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.json({ success: true, comision: serializeComision(updated) });
  } catch (error) {
    console.error('Error actualizando comisión:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'La combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error actualizando comisión' });
  }
}

async function patchComision(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const existing = await prisma.comision.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    }
    const changes = mapComisionPatch(req.body);
    if (!Object.keys(changes).length) {
      return res.json({ success: true, comision: serializeComision(existing) });
    }
    const merged = { ...existing, ...changes };
    ensureRequiredFields(merged);
    const conflicts = await findConflicts(merged, id);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La comisión actualizada entra en conflicto con comisiones existentes',
        conflicts,
      });
    }
    const updated = await prisma.comision.update({
      where: { id },
      data: changes,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.json({ success: true, comision: serializeComision(updated) });
  } catch (error) {
    console.error('Error actualizando comisión parcialmente:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error actualizando la comisión' });
  }
}

async function cloneComision(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const source = await prisma.comision.findUnique({ where: { id } });
    if (!source) {
      return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    }
    const overrides = req.body || {};
    const data = {
      ...source,
      ...mapComisionData({ ...source, ...overrides }),
    };
    data.id = undefined;
    data.creado_el = undefined;
    data.actualizado_el = undefined;
    ensureRequiredFields(data);
    const conflicts = await findConflicts(data);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La comisión clonada entra en conflicto con comisiones existentes',
        conflicts,
      });
    }
    const created = await prisma.comision.create({
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json({ success: true, comision: serializeComision(created) });
  } catch (error) {
    console.error('Error clonando comisión:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'La combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error clonando comisión' });
  }
}

async function toggleComision(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const comision = await prisma.comision.findUnique({ where: { id } });
    if (!comision) {
      return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    }
    const updated = await prisma.comision.update({
      where: { id },
      data: { activo: !comision.activo },
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.json({ success: true, comision: serializeComision(updated) });
  } catch (error) {
    console.error('Error alternando comisión:', error);
    res.status(500).json({ success: false, message: 'Error modificando estado de la comisión' });
  }
}

module.exports = {
  getComisiones,
  getComision,
  createComision,
  updateComision,
  patchComision,
  cloneComision,
  toggleComision,
};