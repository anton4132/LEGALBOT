const { Prisma } = require('@prisma/client');

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

function periodsOverlap(aDesde, aHasta, bDesde, bHasta) {
  const startA = aDesde ? new Date(aDesde).getTime() : Number.NEGATIVE_INFINITY;
  const endA = aHasta ? new Date(aHasta).getTime() : Number.POSITIVE_INFINITY;
  const startB = bDesde ? new Date(bDesde).getTime() : Number.NEGATIVE_INFINITY;
  const endB = bHasta ? new Date(bHasta).getTime() : Number.POSITIVE_INFINITY;
  return startA <= endB && startB <= endA;
}

function sameScope(a, b, fields) {
  return fields.every((field) => {
    const valueA = a[field] ?? null;
    const valueB = b[field] ?? null;
    return valueA === valueB;
  });
}

function collectConflictIds(records, fields) {
  const ids = new Set();
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const a = records[i];
      const b = records[j];
      if (!sameScope(a, b, fields)) continue;
      if (a.activo === false && b.activo === false) continue;
      if (periodsOverlap(a.vigencia_desde, a.vigencia_hasta, b.vigencia_desde, b.vigencia_hasta)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return Array.from(ids);
}

function buildOverlapWhere(data, fields, excludeId) {
  const where = {
    activo: true,
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  fields.forEach((field) => {
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

module.exports = {
  parseIntOrNull,
  parseDate,
  toDecimal,
  decimalToNumber,
  periodsOverlap,
  sameScope,
  collectConflictIds,
  buildOverlapWhere,
};