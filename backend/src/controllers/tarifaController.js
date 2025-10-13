const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

const PARAM_TEMPLATES = {
  fijo: { monto: 0 },
  minimo_mas_variable: { minimo: 0, porcentaje_variable: 0 },
  paquete: { tamano_bloque: 0, precio_bloque: 0 },
  consumo_ia: { rate: 0, minimo: 0 },
  estacional: { multiplicadores: [{ desde: '', hasta: '', factor: 1 }] },
};

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDecimal(value) {
  if (value === undefined || value === null || value === '') return null;
  return new Prisma.Decimal(value);
}

function decimalToNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  return Number(value);
}

function serializeTarifa(tarifa) {
  if (!tarifa) return null;
  const {
    servicio,
    plan,
    valor,
    parametros,
    vigencia_desde,
    vigencia_hasta,
    ...rest
  } = tarifa;
  return {
    ...rest,
    servicio,
    plan,
    valor: decimalToNumber(valor),
    parametros: parametros ?? null,
    vigencia_desde: vigencia_desde ? vigencia_desde.toISOString() : null,
    vigencia_hasta: vigencia_hasta ? vigencia_hasta.toISOString() : null,
  };
}

function mapTarifaData(payload) {
  return {
    codigo: payload.codigo?.trim(),
    descripcion: payload.descripcion?.trim() || null,
    servicio_id: parseIntOrNull(payload.servicio_id),
    plan_id: parseIntOrNull(payload.plan_id),
    rol_aplica: payload.rol_aplica,
    moneda: payload.moneda?.trim() || null,
    tipo_calculo: payload.tipo_calculo,
    valor: toDecimal(payload.valor),
    parametros: payload.parametros ?? null,
    incluye_impuesto: payload.incluye_impuesto ?? false,
    vigencia_desde: parseDate(payload.vigencia_desde),
    vigencia_hasta: parseDate(payload.vigencia_hasta),
    prioridad: payload.prioridad === '' || payload.prioridad === undefined ? null : Number(payload.prioridad),
    ambito_region: payload.ambito_region?.trim() || null,
    metodo_pago: payload.metodo_pago?.trim() || null,
    activo: payload.activo ?? true,
    tipo: payload.tipo?.trim() || 'tarifa',
  };
}

function buildListWhere(query) {
  const where = {};
  const servicioId = parseIntOrNull(query.servicio_id);
  const planId = parseIntOrNull(query.plan_id);
  const rol = query.rol_aplica?.trim();
  const estado = query.activo?.trim();
  const metodo = query.metodo_pago?.trim();
  const moneda = query.moneda?.trim();
  const region = query.ambito_region?.trim();
  const fecha = parseDate(query.fecha);

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
  if (metodo) {
    where.metodo_pago = metodo;
  }
  if (moneda) {
    where.moneda = moneda;
  }
  if (region) {
    where.ambito_region = region;
  }
  if (fecha) {
    where.AND = [
      {
        OR: [
          { vigencia_desde: null },
          { vigencia_desde: { lte: fecha } },
        ],
      },
      {
        OR: [
          { vigencia_hasta: null },
          { vigencia_hasta: { gte: fecha } },
        ],
      },
    ];
  }
  return where;
}

function buildOverlapWhere(data, excludeId) {
  const where = {
    activo: true,
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  const eqFields = [
    'servicio_id',
    'plan_id',
    'rol_aplica',
    'ambito_region',
    'metodo_pago',
    'moneda',
  ];
  eqFields.forEach((field) => {
    if (data[field] !== undefined) {
      where[field] = data[field];
    }
  });
  const start = data.vigencia_desde ? new Date(data.vigencia_desde) : null;
  const end = data.vigencia_hasta ? new Date(data.vigencia_hasta) : null;
  const range = [];
  if (start) {
    range.push({ OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: start } }] });
  }
  if (end) {
    range.push({ OR: [{ vigencia_desde: null }, { vigencia_desde: { lte: end } }] });
  }
  if (range.length) {
    where.AND = range;
  }
  return where;
}

async function findConflicts(data, excludeId) {
  if (data.activo === false) return [];
  const where = buildOverlapWhere(data, excludeId);
  const overlaps = await prisma.tarifacomision.findMany({
    where,
    include: {
      servicio: { select: { id: true, nombre: true, codigo: true } },
      plan: { select: { id: true, nombre: true } },
    },
  });
  return overlaps.map((item) => serializeTarifa(item));
}

async function getTarifas(req, res) {
  try {
    const page = parseIntOrNull(req.query.page) || 1;
    const perPage = parseIntOrNull(req.query.per_page) || 20;
    const where = buildListWhere(req.query);
    const [items, total] = await Promise.all([
      prisma.tarifacomision.findMany({
        where,
        include: {
          servicio: { select: { id: true, codigo: true, nombre: true } },
          plan: { select: { id: true, nombre: true } },
        },
        orderBy: [
          { prioridad: 'desc' },
          { codigo: 'asc' },
        ],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.tarifacomision.count({ where }),
    ]);
    res.json({
      items: items.map((item) => serializeTarifa(item)),
      total,
      page,
      perPage,
    });
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
    const tarifa = await prisma.tarifacomision.findUnique({
      where: { id },
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    if (!tarifa) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    res.json(serializeTarifa(tarifa));
  } catch (error) {
    console.error('Error obteniendo tarifa:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tarifa' });
  }
}

async function createTarifa(req, res) {
  try {
    const data = mapTarifaData(req.body);
    if (!data.codigo) {
      return res.status(400).json({ success: false, message: 'El código es obligatorio' });
    }
    if (!data.rol_aplica) {
      return res.status(400).json({ success: false, message: 'El rol aplica es obligatorio' });
    }
    if (!data.tipo_calculo) {
      return res.status(400).json({ success: false, message: 'El tipo de cálculo es obligatorio' });
    }
    const conflicts = await findConflicts(data);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La nueva regla entra en conflicto con reglas existentes',
        conflicts,
      });
    }
    const created = await prisma.tarifacomision.create({
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json({ success: true, tarifa: serializeTarifa(created) });
  } catch (error) {
    console.error('Error creando tarifa:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'El código o combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error creando tarifa' });
  }
}

async function updateTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const previous = await prisma.tarifacomision.findUnique({ where: { id } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    const data = mapTarifaData(req.body);
    const conflicts = await findConflicts({ ...previous, ...data }, id);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La regla actualizada entra en conflicto con reglas existentes',
        conflicts,
      });
    }
    const updated = await prisma.tarifacomision.update({
      where: { id },
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.json({ success: true, tarifa: serializeTarifa(updated) });
  } catch (error) {
    console.error('Error actualizando tarifa:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'El código o combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error actualizando tarifa' });
  }
}

async function cloneTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const source = await prisma.tarifacomision.findUnique({ where: { id } });
    if (!source) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    const overrides = req.body || {};
    const data = {
      ...source,
      ...mapTarifaData({ ...source, ...overrides }),
    };
    data.codigo = overrides.codigo?.trim();
    if (!data.codigo) {
      return res.status(400).json({ success: false, message: 'Debe indicar un código para la nueva regla' });
    }
    data.id = undefined;
    data.created_at = undefined;
    data.updated_at = undefined;
    const conflicts = await findConflicts(data);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: 'La copia propuesta entra en conflicto con reglas existentes',
        conflicts,
      });
    }
    const created = await prisma.tarifacomision.create({
      data,
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json({ success: true, tarifa: serializeTarifa(created) });
  } catch (error) {
    console.error('Error clonando tarifa:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'El código o combinación ya existe' });
    }
    res.status(500).json({ success: false, message: 'Error clonando tarifa' });
  }
}

async function toggleTarifa(req, res) {
  try {
    const id = parseIntOrNull(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Identificador inválido' });
    }
    const tarifa = await prisma.tarifacomision.findUnique({ where: { id } });
    if (!tarifa) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }
    const updated = await prisma.tarifacomision.update({
      where: { id },
      data: { activo: !tarifa.activo },
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });
    res.json({ success: true, tarifa: serializeTarifa(updated) });
  } catch (error) {
    console.error('Error alternando tarifa:', error);
    res.status(500).json({ success: false, message: 'Error modificando estado de la tarifa' });
  }
}

function valueToRate(value) {
  const num = decimalToNumber(value) || 0;
  return num > 1 ? num / 100 : num;
}

function resolveVigenciaMatch(entity, fecha) {
  if (!entity) return true;
  const desde = entity.vigencia_desde ? new Date(entity.vigencia_desde) : null;
  const hasta = entity.vigencia_hasta ? new Date(entity.vigencia_hasta) : null;
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

async function fetchEconomyContext() {
  const [econconfig, impuestosRaw, pasarelasRaw] = await Promise.all([
    prisma.econconfig.findFirst({
      where: { activo: true },
      orderBy: { actualizado_el: 'desc' },
    }),
    prisma.impuesto.findMany({ where: { activo: true } }),
    prisma.pasarela.findMany({
      where: { activo: true },
      include: {
        reglas_metodo: { where: { activo: true } },
      },
    }),
  ]);
  const impuestos = impuestosRaw.map((imp) => ({
    ...imp,
    porcentaje: valueToRate(imp.porcentaje),
  }));
  const metodosPsp = [];
  pasarelasRaw.forEach((pasarela) => {
    metodosPsp.push({
      metodo_pago: '*',
      porcentaje: valueToRate(pasarela.porcentaje),
      fijo: decimalToNumber(pasarela.fijo) || 0,
      quien_absorbe_psp: pasarela.quien_absorbe,
    });
    pasarela.reglas_metodo.forEach((regla) => {
      metodosPsp.push({
        metodo_pago: regla.metodo_pago,
        porcentaje: valueToRate(regla.porcentaje ?? pasarela.porcentaje),
        fijo: decimalToNumber(regla.fijo ?? pasarela.fijo) || 0,
        quien_absorbe_psp: regla.quien_absorbe ?? pasarela.quien_absorbe,
      });
    });
  });
  return {
    econconfig,
    impuestos,
    pasarelas: pasarelasRaw,
    metodosPsp,
  };
}

function applyRounding(value, econconfig) {
  if (!econconfig) return Number((value ?? 0).toFixed(2));
  const decimales = econconfig.decimales ?? 2;
  const regla = econconfig.regla_redondeo || 'dos_decimales';
  const factor = 10 ** decimales;
  const raw = Number(value ?? 0);
  if (Number.isNaN(raw)) return 0;
  switch (regla) {
    case 'a_0_05':
      return Math.ceil(raw * 20) / 20;
    case 'entero_superior':
      return Math.ceil(raw);
    case 'dos_decimales':
    default:
      return Math.round(raw * factor) / factor;
  }
}

async function getCatalogs(req, res) {
  try {
    const [servicios, planes, reglas, econ] = await Promise.all([
      prisma.servicio.findMany({
        select: { id: true, codigo: true, nombre: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.plan.findMany({
        select: { id: true, nombre: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.tarifacomision.findMany({
        select: {
          moneda: true,
          metodo_pago: true,
          ambito_region: true,
        },
      }),
      fetchEconomyContext(),
    ]);
    const monedasSet = new Set();
    const metodosSet = new Set();
    const regionesSet = new Set();
    reglas.forEach((r) => {
      if (r.moneda) monedasSet.add(r.moneda);
      if (r.metodo_pago) metodosSet.add(r.metodo_pago);
      if (r.ambito_region) regionesSet.add(r.ambito_region);
    });
    if (econ.econconfig?.moneda_defecto) {
      monedasSet.add(econ.econconfig.moneda_defecto);
    }
    econ.metodosPsp.forEach((m) => {
      if (m.metodo_pago && m.metodo_pago !== '*') {
        metodosSet.add(m.metodo_pago);
      }
    });
    const response = {
      servicios,
      planes,
      monedas: Array.from(monedasSet).sort(),
      metodos_pago: Array.from(metodosSet).sort(),
      regiones: Array.from(regionesSet).sort(),
      roles: ['cliente', 'abogado', 'ambos'],
      econconfig: econ.econconfig,
      impuestos: econ.impuestos,
      pasarelas: econ.pasarelas,
      parametrosPlantilla: PARAM_TEMPLATES,
    };
    res.json(response);
  } catch (error) {
    console.error('Error obteniendo catálogos de tarifas:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo catálogos' });
  }
}

function matchesRule(rule, context) {
  const {
    servicio_id,
    plan_id,
    rol_aplica,
    moneda,
    metodo_pago,
    ambito_region,
    fecha,
  } = context;
  if (!rule.activo) return false;
  if (!resolveVigenciaMatch(rule, fecha)) return false;
  if (servicio_id && rule.servicio_id && rule.servicio_id !== servicio_id) return false;
  if (plan_id && rule.plan_id && rule.plan_id !== plan_id) return false;
  if (rol_aplica && rule.rol_aplica !== 'ambos' && rule.rol_aplica !== rol_aplica) return false;
  if (moneda && rule.moneda && rule.moneda !== moneda) return false;
  if (metodo_pago && rule.metodo_pago && rule.metodo_pago !== '*' && rule.metodo_pago !== metodo_pago) return false;
  if (ambito_region && rule.ambito_region && rule.ambito_region !== '*' && rule.ambito_region !== ambito_region) return false;
  return true;
}

function getSpecificity(rule, context) {
  if (rule.servicio_id && rule.plan_id) return 3;
  if (rule.servicio_id) return 2;
  if (rule.plan_id) return 1;
  return 0;
}

function computeSubtotal(rule, consumo) {
  const params = rule.parametros || {};
  switch (rule.tipo_calculo) {
    case 'fijo':
      return Number(params.monto ?? rule.valor ?? 0);
    case 'minimo_mas_variable': {
      const minimo = Number(params.minimo ?? 0);
      const porcentaje = Number(params.porcentaje_variable ?? 0);
      const variable = Number(consumo || 0) * porcentaje;
      return Math.max(minimo, minimo + variable);
    }
    case 'paquete': {
      const tamano = Number(params.tamano_bloque || 1);
      const precio = Number(params.precio_bloque || 0);
      const consumoReal = Number(consumo || 0);
      const bloques = tamano <= 0 ? 0 : Math.ceil(consumoReal / tamano);
      return bloques * precio;
    }
    case 'consumo_ia': {
      const rate = Number(params.rate || 0);
      const minimo = Number(params.minimo || 0);
      const monto = Number(consumo || 0) * rate;
      return Math.max(minimo, monto);
    }
    case 'estacional': {
      const base = Number(rule.valor || 0);
      if (!Array.isArray(params.multiplicadores)) return base;
      return params.multiplicadores.reduce((acc, periodo) => {
        if (!periodo) return acc;
        const factor = Number(periodo.factor || 1);
        if (!periodo.desde && !periodo.hasta) {
          return acc * factor;
        }
        const desde = parseDate(periodo.desde) || null;
        const hasta = parseDate(periodo.hasta) || null;
        if (resolveVigenciaMatch({ vigencia_desde: desde, vigencia_hasta: hasta }, new Date())) {
          return acc * factor;
        }
        return acc;
      }, base);
    }
    default:
      return Number(rule.valor || 0);
  }
}

function selectPspMethod(context, metodoPago) {
  const metodo = metodoPago || context.metodo_pago || null;
  if (!context.metodosPsp || context.metodosPsp.length === 0) {
    return { porcentaje: 0, fijo: 0, quien_absorbe_psp: 'plataforma' };
  }
  const specific = context.metodosPsp.find((m) => metodo && m.metodo_pago === metodo);
  if (specific) return specific;
  const wildcard = context.metodosPsp.find((m) => m.metodo_pago === '*');
  return wildcard || { porcentaje: 0, fijo: 0, quien_absorbe_psp: 'plataforma' };
}

async function simulateTarifa(req, res) {
  try {
    const servicioId = parseIntOrNull(req.body.servicio_id);
    const planId = parseIntOrNull(req.body.plan_id);
    const rol = req.body.rol_aplica || null;
    const metodo = req.body.metodo_pago?.trim() || null;
    const region = req.body.ambito_region?.trim() || null;
    const fecha = parseDate(req.body.fecha) || new Date();
    const consumo = Number(req.body.consumo || 0);

    const context = await fetchEconomyContext();
    const moneda = req.body.moneda?.trim() || context.econconfig?.moneda_defecto || null;

    const reglas = await prisma.tarifacomision.findMany({
      where: {
        activo: true,
        AND: [
          {
            OR: [
              { vigencia_desde: null },
              { vigencia_desde: { lte: fecha } },
            ],
          },
          {
            OR: [
              { vigencia_hasta: null },
              { vigencia_hasta: { gte: fecha } },
            ],
          },
        ],
      },
      include: {
        servicio: { select: { id: true, codigo: true, nombre: true } },
        plan: { select: { id: true, nombre: true } },
      },
    });

    if (req.body.regla_preview) {
      const previewPayload = req.body.regla_preview;
      const previewRule = {
        ...previewPayload,
        id: 0,
        codigo: previewPayload.codigo || 'BORRADOR',
        servicio_id: parseIntOrNull(previewPayload.servicio_id),
        plan_id: parseIntOrNull(previewPayload.plan_id),
        rol_aplica: previewPayload.rol_aplica,
        moneda: previewPayload.moneda || moneda,
        metodo_pago: previewPayload.metodo_pago || null,
        ambito_region: previewPayload.ambito_region || null,
        tipo_calculo: previewPayload.tipo_calculo,
        valor: previewPayload.valor ?? null,
        parametros: previewPayload.parametros ?? null,
        incluye_impuesto: previewPayload.incluye_impuesto ?? false,
        vigencia_desde: parseDate(previewPayload.vigencia_desde),
        vigencia_hasta: parseDate(previewPayload.vigencia_hasta),
        prioridad: previewPayload.prioridad ?? null,
        activo: previewPayload.activo !== false,
        servicio: previewPayload.servicio || null,
        plan: previewPayload.plan || null,
      };
      reglas.push(previewRule);
    }

    const matchContext = {
      servicio_id: servicioId,
      plan_id: planId,
      rol_aplica: rol,
      moneda,
      metodo_pago: metodo,
      ambito_region: region,
      fecha,
    };

    const candidatos = reglas.filter((rule) => matchesRule(rule, matchContext));
    if (candidatos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró una regla aplicable',
        econconfig: context.econconfig,
      });
    }
    candidatos.sort((a, b) => {
      const specDiff = getSpecificity(b, matchContext) - getSpecificity(a, matchContext);
      if (specDiff !== 0) return specDiff;
      const priorityDiff = (b.prioridad ?? -Infinity) - (a.prioridad ?? -Infinity);
      if (priorityDiff !== 0) return priorityDiff;
      const desdeA = a.vigencia_desde ? a.vigencia_desde.getTime() : 0;
      const desdeB = b.vigencia_desde ? b.vigencia_desde.getTime() : 0;
      return desdeB - desdeA;
    });

    const selected = candidatos[0];
    const subtotalBase = computeSubtotal(selected, consumo);
    const applicableTaxes = context.impuestos.filter((imp) => resolveVigenciaMatch(imp, fecha));
    const impuestoTotal = selected.incluye_impuesto
      ? 0
      : applicableTaxes.reduce((acc, imp) => acc + subtotalBase * imp.porcentaje, 0);
    const metodoPsp = selectPspMethod(context, metodo);
    const feePsp = subtotalBase * (metodoPsp.porcentaje || 0) + (metodoPsp.fijo || 0);
    const totalCliente = subtotalBase + impuestoTotal + feePsp;
    const netoAbogado = subtotalBase - feePsp;

    const subtotal = applyRounding(subtotalBase, context.econconfig);
    const impuestos = applyRounding(impuestoTotal, context.econconfig);
    const fee = applyRounding(feePsp, context.econconfig);
    const total = applyRounding(totalCliente, context.econconfig);
    const neto = applyRounding(netoAbogado, context.econconfig);

    res.json({
      success: true,
      regla: serializeTarifa(selected),
      desglose: {
        subtotal,
        impuestos,
        feePsp: fee,
        totalCliente: total,
        netoAbogado: neto,
        moneda,
        impuestos_detalle: applicableTaxes.map((imp) => ({
          codigo: imp.codigo,
          nombre: imp.nombre,
          porcentaje: imp.porcentaje,
        })),
        pasarela: metodoPsp,
      },
      contexto: {
        econconfig: context.econconfig,
      },
    });
  } catch (error) {
    console.error('Error simulando tarifa:', error);
    res.status(500).json({ success: false, message: 'Error simulando tarifa' });
  }
}

module.exports = {
  getTarifas,
  getTarifa,
  createTarifa,
  updateTarifa,
  cloneTarifa,
  toggleTarifa,
  getCatalogs,
  simulateTarifa,
};