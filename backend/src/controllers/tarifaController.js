const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');
const {
  parseIntOrNull,
  parseDate,
  toDecimal,
  decimalToNumber,
} = require('./helpers/ruleUtils');

const TARIFA_INCLUDE = {
  plan: { select: { id: true, nombre: true, activo: true } },
  servicio: { select: { id: true, nombre: true, codigo: true, activo: true } },
};

const ALLOWED_TIPO_CALCULO = new Set(['fijo', 'consumo_ia']);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeParametros(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return {};
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (!isPlainObject(parsed)) {
        throw createHttpError(400, 'Los parámetros deben ser un objeto JSON');
      }
      return parsed;
    } catch (error) {
      if (error.statusCode === 400) throw error;
      throw createHttpError(400, 'Los parámetros deben ser un JSON válido');
    }
  }
  if (!isPlainObject(value)) {
    throw createHttpError(400, 'Los parámetros deben ser un objeto JSON');
  }
  return value;
}

function parseValor(value, { required } = {}) {
  if (value === undefined) {
    if (required) {
      throw createHttpError(400, 'El valor es obligatorio');
    }
    return undefined;
  }
  if (value === null || value === '') {
    if (required) {
      throw createHttpError(400, 'El valor es obligatorio');
    }
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw createHttpError(400, 'El valor debe ser un número válido');
  }
  if (numeric < 0) {
    throw createHttpError(400, 'El valor debe ser mayor o igual a cero');
  }
  return toDecimal(numeric);
}

function normalizeTipoCalculo(value, { required } = {}) {
  if (value === undefined) {
    if (required) {
      throw createHttpError(400, 'El tipo de cálculo es obligatorio');
    }
    return undefined;
  }
  if (value === null || value === '') {
    if (required) {
      throw createHttpError(400, 'El tipo de cálculo es obligatorio');
    }
    return null;
  }
  const normalized = String(value).trim();
  if (!ALLOWED_TIPO_CALCULO.has(normalized)) {
    throw createHttpError(400, 'El tipo de cálculo proporcionado no es válido');
  }
  return normalized;
}

function determineAmbito(record) {
  if (record.plan_id && record.servicio_id) return 'plan-servicio';
  if (record.plan_id) return 'plan';
  if (record.servicio_id) return 'servicio';
  return 'general';
}

function determineNombreAmbito(record) {
  const planName = record?.plan?.nombre || null;
  const servicio = record?.servicio || {};
  const servicioName = servicio.nombre || servicio.codigo || null;
  if (planName && servicioName) return `${planName} · ${servicioName}`;
  if (planName) return planName;
  if (servicioName) return servicioName;
  return null;
}

function serializeTarifa(tarifa) {
  if (!tarifa) return null;
  return {
    id: tarifa.id,
    descripcion: tarifa.descripcion,
    valor: decimalToNumber(tarifa.valor),
    incluye_impuesto: tarifa.incluye_impuesto,
    tipo_calculo: tarifa.tipo_calculo,
    parametros: tarifa.parametros || {},
    activo: tarifa.activo,
    vigencia_desde: tarifa.vigencia_desde
      ? tarifa.vigencia_desde.toISOString().slice(0, 10)
      : null,
    vigencia_hasta: tarifa.vigencia_hasta
      ? tarifa.vigencia_hasta.toISOString().slice(0, 10)
      : null,
    plan_id: tarifa.plan_id,
    servicio_id: tarifa.servicio_id,
    plan: tarifa.plan
      ? {
          id: tarifa.plan.id,
          nombre: tarifa.plan.nombre,
          activo: tarifa.plan.activo !== false,
        }
      : null,
    servicio: tarifa.servicio
      ? {
          id: tarifa.servicio.id,
          nombre: tarifa.servicio.nombre,
          codigo: tarifa.servicio.codigo,
          activo: tarifa.servicio.activo !== false,
        }
      : null,
    ambito: determineAmbito(tarifa),
    nombre_ambito: determineNombreAmbito(tarifa),
    creado_el: tarifa.creado_el ? tarifa.creado_el.toISOString() : null,
    actualizado_el: tarifa.actualizado_el
      ? tarifa.actualizado_el.toISOString()
      : null,
  };
}

function validateDateRange(desde, hasta) {
  if (desde && hasta && hasta < desde) {
    throw createHttpError(
      400,
      'La vigencia hasta debe ser mayor o igual a la vigencia desde'
    );
  }
}

function normalizeTarifaInput(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw createHttpError(400, 'No se recibieron datos de tarifa');
  }
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'descripcion')) {
    data.descripcion = payload.descripcion?.trim() || null;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'valor')) {
    data.valor = parseValor(payload.valor, { required: !partial });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'incluye_impuesto')) {
    const raw = payload.incluye_impuesto;
    data.incluye_impuesto = raw === undefined ? false : !!raw;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'tipo_calculo')) {
    data.tipo_calculo = normalizeTipoCalculo(payload.tipo_calculo, {
      required: !partial,
    });
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'parametros')) {
    data.parametros = normalizeParametros(payload.parametros);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'vigencia_desde')) {
    data.vigencia_desde = parseDate(payload.vigencia_desde);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'vigencia_hasta')) {
    data.vigencia_hasta = parseDate(payload.vigencia_hasta);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'activo')) {
    const raw = payload.activo;
    data.activo = raw === undefined ? true : !!raw;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'plan_id')) {
    data.plan_id = parseIntOrNull(payload.plan_id);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'servicio_id')) {
    data.servicio_id = parseIntOrNull(payload.servicio_id);
  }

  return data;
}

function ensureTarifaModel(data) {
  if (data.valor === null || data.valor === undefined) {
    throw createHttpError(400, 'El valor es obligatorio');
  }
  if (!(data.valor instanceof Prisma.Decimal)) {
    throw createHttpError(400, 'El valor debe ser un número válido');
  }
  if (!data.tipo_calculo) {
    throw createHttpError(400, 'El tipo de cálculo es obligatorio');
  }
  if (!ALLOWED_TIPO_CALCULO.has(data.tipo_calculo)) {
    throw createHttpError(400, 'El tipo de cálculo proporcionado no es válido');
  }
  if (data.parametros !== undefined && data.parametros !== null) {
    if (!isPlainObject(data.parametros)) {
      throw createHttpError(400, 'Los parámetros deben ser un objeto JSON');
    }
  }
  validateDateRange(data.vigencia_desde, data.vigencia_hasta);
}

async function ensureReferences(data, { checkPlan = true, checkServicio = true } = {}) {
  if (checkPlan && Object.prototype.hasOwnProperty.call(data, 'plan_id')) {
    if (data.plan_id !== null && data.plan_id !== undefined) {
      const plan = await prisma.plan.findUnique({
        where: { id: data.plan_id },
        select: { id: true },
      });
      if (!plan) {
        throw createHttpError(400, 'El plan especificado no existe');
      }
    }
  }
  if (checkServicio && Object.prototype.hasOwnProperty.call(data, 'servicio_id')) {
    if (data.servicio_id !== null && data.servicio_id !== undefined) {
      const servicio = await prisma.servicio.findUnique({
        where: { id: data.servicio_id },
        select: { id: true },
      });
      if (!servicio) {
        throw createHttpError(400, 'El servicio especificado no existe');
      }
    }
  }
}

function mergeTarifa(existing, changes) {
  return {
    ...existing,
    descripcion: changes.descripcion ?? existing.descripcion,
    valor: changes.valor ?? existing.valor,
    incluye_impuesto: changes.incluye_impuesto ?? existing.incluye_impuesto,
    tipo_calculo: changes.tipo_calculo ?? existing.tipo_calculo,
    parametros: changes.parametros ?? existing.parametros,
    activo: changes.activo ?? existing.activo,
    vigencia_desde: Object.prototype.hasOwnProperty.call(changes, 'vigencia_desde')
      ? changes.vigencia_desde
      : existing.vigencia_desde,
    vigencia_hasta: Object.prototype.hasOwnProperty.call(changes, 'vigencia_hasta')
      ? changes.vigencia_hasta
      : existing.vigencia_hasta,
    plan_id: Object.prototype.hasOwnProperty.call(changes, 'plan_id')
      ? changes.plan_id
      : existing.plan_id,
    servicio_id: Object.prototype.hasOwnProperty.call(changes, 'servicio_id')
      ? changes.servicio_id
      : existing.servicio_id,
  };
}

function ensureUnmodifiedSince(headerValue, entity) {
  if (!headerValue) return;
  const expected = new Date(headerValue);
  if (Number.isNaN(expected.getTime())) {
    throw createHttpError(400, 'El encabezado If-Unmodified-Since es inválido');
  }
  if (!entity.actualizado_el) return;
  if (entity.actualizado_el.getTime() !== expected.getTime()) {
    throw createHttpError(412, 'La tarifa fue modificada recientemente');
  }
}

function buildListWhere(query = {}) {
  const where = {};
  const servicioId = parseIntOrNull(query.servicio_id);
  const planId = parseIntOrNull(query.plan_id);
  if (servicioId !== null) where.servicio_id = servicioId;
  if (planId !== null) where.plan_id = planId;
  if (query.activo === 'true') {
    where.activo = true;
  } else if (query.activo === 'false') {
    where.activo = false;
  }
  const fecha = parseDate(query.fecha);
  const vigencia = query.vigencia?.trim();
  const search = query.search?.trim();
  const andClauses = [];
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
    const baseDate = fecha || new Date();
    if (vigencia === 'vigentes') {
      andClauses.push({
        OR: [
          { vigencia_desde: null },
          { vigencia_desde: { lte: baseDate } },
        ],
      });
      andClauses.push({
        OR: [
          { vigencia_hasta: null },
          { vigencia_hasta: { gte: baseDate } },
        ],
      });
    } else if (vigencia === 'futuras') {
      andClauses.push({ vigencia_desde: { gt: baseDate } });
    } else if (vigencia === 'vencidas') {
      andClauses.push({ vigencia_hasta: { lt: baseDate } });
    }
  }
  if (search) {
    const parsedId = parseIntOrNull(search);
    const or = [{ descripcion: { contains: search, mode: 'insensitive' } }];
    if (parsedId !== null) {
      or.push({ id: parsedId });
    }
    andClauses.push({ OR: or });
  }
  if (andClauses.length) {
    where.AND = andClauses;
  }
  return where;
}

async function fetchTarifa(id) {
  return prisma.tarifa.findUnique({
    where: { id },
    include: TARIFA_INCLUDE,
  });
}

async function getTarifas(req, res) {
  try {
    const where = buildListWhere(req.query);
    const items = await prisma.tarifa.findMany({
      where,
      include: TARIFA_INCLUDE,
      orderBy: [
        { activo: 'desc' },
        { actualizado_el: 'desc' },
        { id: 'asc' },
      ],
    });
    res.json({ success: true, items: items.map(serializeTarifa) });
  } catch (error) {
    console.error('Error obteniendo tarifas:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tarifas' });
  }
}

async function getTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const tarifa = await fetchTarifa(id);
    if (!tarifa) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    res.json({ success: true, tarifa: serializeTarifa(tarifa) });
  } catch (error) {
    console.error('Error obteniendo tarifa:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tarifa' });
  }
}

async function createTarifa(req, res) {
  try {
    const data = normalizeTarifaInput(req.body, { partial: false });
    ensureTarifaModel(data);
    await ensureReferences(data);
    const created = await prisma.tarifa.create({
      data,
      include: TARIFA_INCLUDE,
    });
    res.status(201).json({ success: true, tarifa: serializeTarifa(created) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Las referencias proporcionadas no existen' });
    }
    console.error('Error creando tarifa:', error);
    res.status(500).json({ success: false, message: 'Error creando tarifa' });
  }
}

async function updateTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const existing = await prisma.tarifa.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    ensureUnmodifiedSince(req.get('if-unmodified-since'), existing);
    const data = normalizeTarifaInput(req.body, { partial: false });
    ensureTarifaModel(data);
    await ensureReferences(data);
    const updated = await prisma.tarifa.update({
      where: { id },
      data,
      include: TARIFA_INCLUDE,
    });
    res.json({ success: true, tarifa: serializeTarifa(updated) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Las referencias proporcionadas no existen' });
    }
    console.error('Error actualizando tarifa:', error);
    res.status(500).json({ success: false, message: 'Error actualizando tarifa' });
  }
}

async function patchTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const existing = await prisma.tarifa.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    const changes = normalizeTarifaInput(req.body, { partial: true });
    if (!Object.keys(changes).length) {
      const fresh = await fetchTarifa(id);
      return res.json({ success: true, tarifa: serializeTarifa(fresh) });
    }
    const merged = mergeTarifa(existing, changes);
    ensureTarifaModel({
      ...merged,
      valor: merged.valor instanceof Prisma.Decimal ? merged.valor : parseValor(merged.valor, { required: true }),
      tipo_calculo: merged.tipo_calculo,
      parametros: merged.parametros,
      vigencia_desde: merged.vigencia_desde,
      vigencia_hasta: merged.vigencia_hasta,
    });
    await ensureReferences(merged, {
      checkPlan: Object.prototype.hasOwnProperty.call(changes, 'plan_id'),
      checkServicio: Object.prototype.hasOwnProperty.call(changes, 'servicio_id'),
    });
    const updated = await prisma.tarifa.update({
      where: { id },
      data: changes,
      include: TARIFA_INCLUDE,
    });
    res.json({ success: true, tarifa: serializeTarifa(updated) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Las referencias proporcionadas no existen' });
    }
    console.error('Error actualizando parcialmente la tarifa:', error);
    res.status(500).json({ success: false, message: 'Error actualizando la tarifa' });
  }
}

async function getCatalogs(req, res) {
  try {
    const [planes, servicios, planServicios] = await Promise.all([
      prisma.plan.findMany({
        select: { id: true, nombre: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.servicio.findMany({
        select: { id: true, nombre: true, codigo: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.planservicio.findMany({
        select: { id: true, plan_id: true, servicio_id: true, activo: true },
      }),
    ]);
    res.json({
      success: true,
      planes,
      servicios,
      planServicios,
    });
  } catch (error) {
    console.error('Error obteniendo catálogos de tarifas:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo catálogos' });
  }
}

module.exports = {
  getTarifas,
  getTarifa,
  createTarifa,
  updateTarifa,
  patchTarifa,
  getCatalogs,
};
