const { prisma } = require('../config/database');

const includeAssignmentRelations = {
  servicio: true,
  plan: true,
};

const parseId = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`El campo ${fieldName} es inválido`);
  }
  return parsed;
};

const parseDate = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`El campo ${fieldName} debe ser una fecha válida`);
  }
  return date;
};

const ensurePlanAndServiceExist = async (planId, serviceId) => {
  const [plan, service] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    prisma.servicio.findUnique({ where: { id: serviceId } }),
  ]);

  if (!plan) {
    throw new Error('Plan no encontrado');
  }
  if (!service) {
    throw new Error('Servicio no encontrado');
  }
};

const ensurePlanUpdatedAt = async (planId) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (plan) {
      await prisma.plan.update({
        where: { id: planId },
        data: { nombre: plan.nombre },
      });
    }
  } catch (error) {
    console.error('No se pudo actualizar la marca de tiempo del plan:', error);
  }
};

const createPlanService = async (req, res) => {
  let planId;
  let serviceId;

  try {
    planId = parseId(req.body.plan_id, 'plan_id');
    serviceId = parseId(req.body.servicio_id, 'servicio_id');
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  let vigenciaDesde;
  let vigenciaHasta;
  try {
    vigenciaDesde = parseDate(req.body.vigencia_desde, 'vigencia_desde');
    vigenciaHasta = parseDate(req.body.vigencia_hasta, 'vigencia_hasta');
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  if (vigenciaDesde && vigenciaHasta && vigenciaDesde >= vigenciaHasta) {
    return res.status(400).json({
      success: false,
      message: 'La vigencia hasta debe ser posterior a la vigencia desde',
    });
  }

  try {
    await ensurePlanAndServiceExist(planId, serviceId);

    const assignment = await prisma.planservicio.create({
      data: {
        plan_id: planId,
        servicio_id: serviceId,
        activo: req.body.activo !== undefined ? Boolean(req.body.activo) : true,
        vigencia_desde: vigenciaDesde,
        vigencia_hasta: vigenciaHasta,
      },
      include: includeAssignmentRelations,
    });

    await ensurePlanUpdatedAt(planId);

    res.status(201).json({
      success: true,
      message: 'Servicio vinculado correctamente',
      planServicio: assignment,
    });
  } catch (error) {
    console.error('Error creando vinculación plan-servicio:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'El servicio ya está vinculado a este plan',
      });
    }

    if (error.message === 'Plan no encontrado' || error.message === 'Servicio no encontrado') {
      return res.status(404).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || 'Error creando la vinculación' });
  }
};

const updatePlanService = async (req, res) => {
  const { id } = req.params;
  let assignmentId;

  try {
    assignmentId = parseId(id, 'id');
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  let planId;
  let serviceId;
  try {
    planId = req.body.plan_id !== undefined ? parseId(req.body.plan_id, 'plan_id') : undefined;
    serviceId = req.body.servicio_id !== undefined ? parseId(req.body.servicio_id, 'servicio_id') : undefined;
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  let vigenciaDesde;
  let vigenciaHasta;
  try {
    vigenciaDesde = parseDate(req.body.vigencia_desde, 'vigencia_desde');
    vigenciaHasta = parseDate(req.body.vigencia_hasta, 'vigencia_hasta');
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  if (vigenciaDesde && vigenciaHasta && vigenciaDesde >= vigenciaHasta) {
    return res.status(400).json({
      success: false,
      message: 'La vigencia hasta debe ser posterior a la vigencia desde',
    });
  }

  try {
    const existing = await prisma.planservicio.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vinculación no encontrada' });
    }

    const finalPlanId = planId ?? existing.plan_id;
    const finalServiceId = serviceId ?? existing.servicio_id;

    await ensurePlanAndServiceExist(finalPlanId, finalServiceId);

    const assignment = await prisma.planservicio.update({
      where: { id: assignmentId },
      data: {
        plan_id: finalPlanId,
        servicio_id: finalServiceId,
        activo: req.body.activo !== undefined ? Boolean(req.body.activo) : existing.activo,
        vigencia_desde: req.body.vigencia_desde === undefined ? existing.vigencia_desde : vigenciaDesde,
        vigencia_hasta: req.body.vigencia_hasta === undefined ? existing.vigencia_hasta : vigenciaHasta,
      },
      include: includeAssignmentRelations,
    });

    await ensurePlanUpdatedAt(assignment.plan_id);

    res.json({
      success: true,
      message: 'Vinculación actualizada correctamente',
      planServicio: assignment,
    });
  } catch (error) {
    console.error('Error actualizando vinculación plan-servicio:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una vinculación entre el plan y el servicio seleccionados',
      });
    }
    if (error.message === 'Plan no encontrado' || error.message === 'Servicio no encontrado') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message || 'Error actualizando la vinculación' });
  }
};

const deletePlanService = async (req, res) => {
  const { id } = req.params;
  let assignmentId;

  try {
    assignmentId = parseId(id, 'id');
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  try {
    const existing = await prisma.planservicio.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vinculación no encontrada' });
    }

    await prisma.planservicio.delete({ where: { id: assignmentId } });
    await ensurePlanUpdatedAt(existing.plan_id);

    res.json({ success: true, message: 'Vinculación eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando vinculación plan-servicio:', error);
    res.status(500).json({ success: false, message: 'Error eliminando la vinculación' });
  }
};

module.exports = {
  createPlanService,
  updatePlanService,
  deletePlanService,
};