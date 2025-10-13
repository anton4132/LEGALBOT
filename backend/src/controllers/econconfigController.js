const { prisma } = require('../config/database');

const ROUNDING_RULES = ['dos_decimales', 'a_0_05', 'entero_superior'];

function normalizeMoneda(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('La moneda por defecto es obligatoria');
  }
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length !== 3) {
    throw new Error('La moneda debe tener 3 caracteres');
  }
  return trimmed;
}

function normalizeDecimales(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error('Los decimales deben ser un número entero');
  }
  if (number < 0 || number > 6) {
    throw new Error('Los decimales deben estar entre 0 y 6');
  }
  return number;
}

function normalizeRegla(value) {
  if (!value) return 'dos_decimales';
  if (!ROUNDING_RULES.includes(value)) {
    throw new Error('Regla de redondeo inválida');
  }
  return value;
}

async function getActiveConfig(req, res) {
  try {
    const config = await prisma.econconfig.findFirst({
      where: { activo: true },
      orderBy: { actualizado_el: 'desc' },
    });
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error obteniendo econconfig:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo configuración económica' });
  }
}

async function saveConfig(req, res) {
  try {
    const moneda_defecto = normalizeMoneda(req.body.moneda_defecto);
    const decimales = normalizeDecimales(req.body.decimales);
    const regla_redondeo = normalizeRegla(req.body.regla_redondeo);
    const activo = req.body.activo !== undefined ? !!req.body.activo : true;

    const existing = await prisma.econconfig.findFirst({
      where: { activo: true },
      orderBy: { actualizado_el: 'desc' },
    });

    let config;
    if (existing) {
      config = await prisma.econconfig.update({
        where: { id: existing.id },
        data: { moneda_defecto, decimales, regla_redondeo, activo },
      });
    } else {
      config = await prisma.econconfig.create({
        data: { moneda_defecto, decimales, regla_redondeo, activo },
      });
    }
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error guardando econconfig:', error);
    res.status(400).json({ success: false, message: error.message || 'Error guardando configuración económica' });
  }
}

module.exports = {
  getActiveConfig,
  saveConfig,
};