const { prisma } = require('../config/database');

// Obtener todos los servicios
const getAllServices = async (req, res) => {
const { search, estado, orderBy = 'nombre', order = 'asc' } = req.query;
  const where = {};
  if (search) {
    where.OR = [
      { codigo: { contains: search, mode: 'insensitive' } },
      { nombre: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (estado === 'true' || estado === 'false') {
    where.activo = estado === 'true';
  }
  const now = new Date();
  try {
    const services = await prisma.servicio.findMany({
        where,
        orderBy:
          orderBy === 'fecha_creada'
            ? { fecha_creada: order }
            : { nombre: order },
        include: {
          planservicios: {
            where: {
              activo: true,
              OR: [
                { vigencia_hasta: null },
                { vigencia_hasta: { gte: now } }
              ]
            }
          },
          tarifas: {
            where: {
              activo: true,
              OR: [
                { vigencia_hasta: null },
                { vigencia_hasta: { gte: now } }
              ]
            }
          }
        }
    });
    const mapped = services.map(s => ({
        ...s,
        tienePlanVigente: s.planservicios.length > 0,
        tieneTarifaVigente: s.tarifas.length > 0
      }));
  
    res.json(mapped);
  } catch (error) {
    console.error('Error obteniendo servicios:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo servicios' });
  }
};

// Crear servicio
const createService = async (req, res) => {
  try {
    const { codigo, nombre, descripcion, activo = true } = req.body;
    if (!codigo || !nombre) {
        return res
        .status(400)
        .json({ success: false, message: 'Código y nombre son obligatorios' });
    }   
    const service = await prisma.servicio.create({
       data: { codigo, nombre, descripcion, activo }
    });
    // Registrar auditoría sin bloquear la respuesta en caso de error
    //logAudit('servicio', service.id, 'create', null, service);

    return res
      .status(201)
      .json({ success: true, message: 'Servicio creado correctamente', service });
  } catch (error) {
    console.error('Error creando servicio:', error);
    if (error.code === 'P2002') {
        return res
          .status(400)
          .json({ success: false, message: 'El código de servicio ya existe' });
      }
    res.status(500).json({ success: false, message: 'Error creando servicio' });
  }
};
// Actualizar servicio
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, activo, force } = req.body;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return res.status(400).json({ success: false, message: 'Identificador de servicio inválido' });
    }
    const previous = await prisma.servicio.findUnique({ where: { id: serviceId } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    }
    if (activo === false) {
      const now = new Date();
      const [activeTariffs, activeCommissions, activePlans] = await Promise.all([
        prisma.tarifa.count({
          where: {
            servicio_id: serviceId,
            activo: true,
            OR: [
              { vigencia_hasta: null },
              { vigencia_hasta: { gte: now } }
            ]
          }
        }),
        prisma.comision.count({
          where: {
            servicio_id: serviceId,
            activo: true,
            OR: [
              { vigencia_hasta: null },
              { vigencia_hasta: { gte: now } }
            ]
          }
        }),
        prisma.planservicio.count({
          where: {
            servicio_id: serviceId,
            activo: true,
            OR: [
              { vigencia_hasta: null },
              { vigencia_hasta: { gte: now } }
            ]
          }
        })
      ]);
      const totalPricingRules = activeTariffs + activeCommissions;
      if ((totalPricingRules > 0 || activePlans > 0) && !force) {
        return res.status(400).json({
          success: false,
          message: 'El servicio tiene tarifas, comisiones o planes vigentes',
          tarifas: totalPricingRules,
          planes: activePlans,
          comisiones: activeCommissions
        });
      }
    }
    const data = {};
    if (codigo !== undefined) data.codigo = codigo;
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (activo !== undefined) data.activo = activo;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No se proporcionaron cambios para el servicio' });
    }

    const service = await prisma.servicio.update({
      where: { id: serviceId },
      data,
    });

    //await logAudit('servicio', serviceId, 'update', previous, service);
    let message = 'Servicio modificado correctamente';
    if (previous.activo && activo === false) {
      message = 'Servicio desactivado correctamente';
    } else if (!previous.activo && activo === true) {
      message = 'Servicio activado correctamente';
    }
    res.json({ success: true, service });
  } catch (error) {
    console.error('Error actualizando servicio:', error);
    if (error.code === 'P2002') {
        return res
          .status(400)
          .json({ success: false, message: 'El código de servicio ya existe' });
      }
      res.status(500).json({ success: false, message: 'Error modificando servicio' });
  }
};

// Desactivar servicio (soft delete)
const deleteService = async (req, res) => {
    req.body = { activo: false, force: req.query.force === 'true' };
    return updateService(req, res);
};

module.exports = {
  getAllServices,
  createService,
  updateService,
  deleteService
};
