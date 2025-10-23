const { prisma } = require('../config/database');

const includePlanServicios = {
  planservicio: {
    include: {
      servicio: true,
    },
  },
};

const parseAlmacenamiento = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('El almacenamiento máximo debe ser un número entero mayor o igual a 0');
  }
  return parsed;
};

const sanitizeNombre = (nombre) => (typeof nombre === 'string' ? nombre.trim() : '');

const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      include: includePlanServicios,
      orderBy: { nombre: 'asc' },
    });
    res.json(plans);
  } catch (error) {
    console.error('Error obteniendo planes:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo planes' });
  }
};

const getPlanById = async (req, res) => {
  const { id } = req.params;
  const planId = Number(id);

  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ success: false, message: 'Identificador de plan inválido' });
  }

  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: includePlanServicios,
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error obteniendo plan:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo plan' });
  }
};

const createPlan = async (req, res) => {
  const nombre = sanitizeNombre(req.body.nombre);

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre del plan es obligatorio' });
  }

  let almacenamiento;
  try {
    almacenamiento = parseAlmacenamiento(req.body.almacenamiento_maximo);
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        nombre,
        almacenamiento_maximo: almacenamiento,
      },
    });

    const withRelations = await prisma.plan.findUnique({
      where: { id: plan.id },
      include: includePlanServicios,
    });

    res.status(201).json({ success: true, message: 'Plan creado correctamente', plan: withRelations });
  } catch (error) {
    console.error('Error creando plan:', error);
    res.status(500).json({ success: false, message: 'Error creando plan' });
  }
};

const updatePlan = async (req, res) => {
  const { id } = req.params;
  const planId = Number(id);

  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ success: false, message: 'Identificador de plan inválido' });
  }

  const nombre = sanitizeNombre(req.body.nombre);
  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre del plan es obligatorio' });
  }

  let almacenamiento;
  try {
    almacenamiento = parseAlmacenamiento(req.body.almacenamiento_maximo);
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  try {
    const existing = await prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    await prisma.plan.update({
      where: { id: planId },
      data: {
        nombre,
        almacenamiento_maximo: almacenamiento,
      },
    });

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: includePlanServicios,
    });

    res.json({ success: true, message: 'Plan actualizado correctamente', plan });
  } catch (error) {
    console.error('Error actualizando plan:', error);
    res.status(500).json({ success: false, message: 'Error actualizando plan' });
  }
};

const deletePlan = async (req, res) => {
  const { id } = req.params;
  const planId = Number(id);

  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ success: false, message: 'Identificador de plan inválido' });
  }

  try {
    const existing = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        planservicios: true,
        tarifas: { where: { activo: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    if ((existing.planservicios || []).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El plan tiene servicios vinculados. Elimina las vinculaciones antes de borrar el plan',
      });
    }

    if ((existing.tarifas || []).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El plan tiene tarifas asociadas. Desactiva o elimina las tarifas antes de borrar el plan',
      });
    }

    await prisma.plan.delete({ where: { id: planId } });
    res.json({ success: true, message: 'Plan eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando plan:', error);
    res.status(500).json({ success: false, message: 'Error eliminando plan' });
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
};