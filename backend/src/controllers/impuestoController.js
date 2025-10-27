const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.isValidation = true;
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Fecha inválida');
  }
  return date;
}

function parseDecimal(value) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError('El porcentaje es obligatorio');
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new ValidationError('El porcentaje debe ser numérico');
  }
  if (numeric < 0) {
    throw new ValidationError('El porcentaje debe ser mayor o igual a 0');
  }
  return new Prisma.Decimal(numeric);
}

function validateVigencia(desde, hasta) {
  if (desde && hasta && desde > hasta) {
    throw new ValidationError('La vigencia hasta debe ser posterior a la vigencia desde');
  }
}

async function deactivateOtherImpuestos(tx, excludeId) {
  const where = excludeId ? { id: { not: excludeId } } : {};
  await tx.impuesto.updateMany({ where, data: { activo: false } });
}

async function listImpuestos(req, res) {
  const { estado } = req.query;
  const where = {};
  if (estado === 'true' || estado === 'false') {
    where.activo = estado === 'true';
  }
  try {
    const impuestos = await prisma.impuesto.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { codigo: 'asc' }],
    });
    res.json({ success: true, items: impuestos });
  } catch (error) {
    console.error('Error obteniendo impuestos:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo impuestos' });
  }
}

async function createImpuesto(req, res) {
  try {
    const {
      codigo,
      nombre,
      porcentaje,
      activo = true,
      vigencia_desde,
      vigencia_hasta,
    } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ success: false, message: 'Código y nombre son obligatorios' });
    }

    const vigenciaDesde = parseDate(vigencia_desde);
    const vigenciaHasta = parseDate(vigencia_hasta);
    validateVigencia(vigenciaDesde, vigenciaHasta);

    const porcentajeDecimal = parseDecimal(porcentaje);
    const isActive = !!activo;

    const created = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await deactivateOtherImpuestos(tx);
      }
      return tx.impuesto.create({
        data: {
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          porcentaje: porcentajeDecimal,
          activo: isActive,
          vigencia_desde: vigenciaDesde,
          vigencia_hasta: vigenciaHasta,
        },
      });
    });
    res.status(201).json({ success: true, item: created });
  } catch (error) {
    console.error('Error creando impuesto:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'El código del impuesto ya existe' });
    }
    if (error instanceof ValidationError || error.isValidation) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error creando impuesto' });
  }
}

async function updateImpuesto(req, res) {
  const { id } = req.params;
  const impuestoId = Number(id);
  if (!impuestoId) {
    return res.status(400).json({ success: false, message: 'Identificador inválido' });
  }
  try {
    const previous = await prisma.impuesto.findUnique({ where: { id: impuestoId } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Impuesto no encontrado' });
    }
    const {
      codigo = previous.codigo,
      nombre = previous.nombre,
      porcentaje = previous.porcentaje,
      activo = previous.activo,
      vigencia_desde = previous.vigencia_desde,
      vigencia_hasta = previous.vigencia_hasta,
    } = req.body;

    const vigenciaDesde = parseDate(vigencia_desde);
    const vigenciaHasta = parseDate(vigencia_hasta);
    validateVigencia(vigenciaDesde, vigenciaHasta);

    const porcentajeDecimal = parseDecimal(porcentaje);
    const isActive = !!activo;
    const ifUnmodifiedSince = req.get('If-Unmodified-Since');
    if (ifUnmodifiedSince) {
      const headerDate = new Date(ifUnmodifiedSince);
      if (!Number.isNaN(headerDate.getTime()) && previous.actualizado_el > headerDate) {
        return res
          .status(409)
          .json({ success: false, message: 'El impuesto fue actualizado por otro usuario' });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.impuesto.update({
        where: { id: impuestoId },
        data: {
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          porcentaje: porcentajeDecimal,
          activo: isActive,
          vigencia_desde: vigenciaDesde,
          vigencia_hasta: vigenciaHasta,
        },
      });
      if (result.activo) {
        await deactivateOtherImpuestos(tx, result.id);
      }
      return result;
    });
    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error actualizando impuesto:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'El código del impuesto ya existe' });
    }
    if (error instanceof ValidationError || error.isValidation) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error actualizando impuesto' });
  }
}

async function partialUpdateImpuesto(req, res) {
  const { id } = req.params;
  const impuestoId = Number(id);
  if (!impuestoId) {
    return res.status(400).json({ success: false, message: 'Identificador inválido' });
  }

  const changes = {};
  if (req.body.activo !== undefined) {
    changes.activo = !!req.body.activo;
  }

  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ success: false, message: 'No se recibieron cambios para actualizar' });
  }

  try {
    const existing = await prisma.impuesto.findUnique({ where: { id: impuestoId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Impuesto no encontrado' });
    }

    const ifUnmodifiedSince = req.get('If-Unmodified-Since');
    if (ifUnmodifiedSince) {
      const headerDate = new Date(ifUnmodifiedSince);
      if (!Number.isNaN(headerDate.getTime()) && existing.actualizado_el > headerDate) {
        return res
          .status(409)
          .json({ success: false, message: 'El impuesto fue actualizado por otro usuario' });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.impuesto.update({ where: { id: impuestoId }, data: changes });
      if (changes.activo && result.activo) {
        await deactivateOtherImpuestos(tx, result.id);
      }
      return result;
    });

    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error actualizando impuesto:', error);
    res.status(500).json({ success: false, message: 'Error actualizando impuesto' });
  }
}

async function deleteImpuesto(req, res) {
  const { id } = req.params;
  const impuestoId = Number(id);
  if (!impuestoId) {
    return res.status(400).json({ success: false, message: 'Identificador inválido' });
  }
  try {
    const previous = await prisma.impuesto.findUnique({ where: { id: impuestoId } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Impuesto no encontrado' });
    }
    if (!previous.activo) {
      return res.json({ success: true, item: previous });
    }
    const updated = await prisma.impuesto.update({
      where: { id: impuestoId },
      data: { activo: false },
    });
    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error desactivando impuesto:', error);
    res.status(500).json({ success: false, message: 'Error desactivando impuesto' });
  }
}

module.exports = {
  listImpuestos,
  createImpuesto,
  updateImpuesto,
  partialUpdateImpuesto,
  deleteImpuesto,
};