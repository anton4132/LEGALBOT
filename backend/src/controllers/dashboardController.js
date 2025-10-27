const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

let cachedRoleForeignKey = null;

async function resolveRoleForeignKey() {
  if (cachedRoleForeignKey) {
    return cachedRoleForeignKey;
  }

  try {
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'usuario'
        AND column_name IN ('role_id', 'rol_id')
      ORDER BY CASE column_name WHEN 'role_id' THEN 0 ELSE 1 END
      LIMIT 1
    `;

    const resolved = Array.isArray(result) && result.length
      ? result[0]?.column_name
      : null;

    cachedRoleForeignKey = resolved || 'role_id';
  } catch (err) {
    console.warn('No se pudo determinar la columna de rol, usando role_id por defecto.', err?.message);
    cachedRoleForeignKey = 'role_id';
  }

  return cachedRoleForeignKey;
}

// Obtener estadísticas del dashboard
const getStats = async (req, res) => {
  try {
    // Contar clientes
    const clientesCount = await prisma.usuario.count({
      where: {
        role: {
          codigo: 'cliente'
        }
      }
    });

    // Contar abogados
    const abogadosCount = await prisma.usuario.count({
      where: {
        role: {
          codigo: 'abogado'
        }
      }
    });

    // Contar citas del mes actual
    const citasCount = await prisma.cita.count({
      where: {
        inicia_el: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }
    });

    // Contar transacciones autorizadas
    const transaccionesCount = await prisma.pago.count({
      where: {
        estadopago: {
          codigo: 'autorizado'
        }
      }
    });

    res.json({
      success: true,
      stats: {
        clientes: clientesCount,
        abogados: abogadosCount,
        citas: citasCount,
        transacciones: transaccionesCount
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas'
    });
  }
};

// Obtener datos de gráficos
const getCharts = async (req, res) => {
  try {
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // 6 semanas atrás

    const roleForeignKey = await resolveRoleForeignKey();
    const roleJoinFragment = Prisma.raw(`u."${roleForeignKey}"`);

    const clientesQuery = Prisma.sql`
      SELECT
        DATE_TRUNC('week', u.creado_el)::DATE as semana,
        COUNT(*)::bigint as nuevos_clientes
      FROM "usuario" u
      JOIN "role" r ON ${roleJoinFragment} = r.id
      WHERE r.codigo = 'cliente'
        AND u.creado_el >= ${sixWeeksAgo}
      GROUP BY DATE_TRUNC('week', u.creado_el)
      ORDER BY semana
    `;

    const abogadosQuery = Prisma.sql`
      SELECT
        DATE_TRUNC('week', u.creado_el)::DATE as semana,
        COUNT(*)::bigint as nuevos_abogados
      FROM "usuario" u
      JOIN "role" r ON ${roleJoinFragment} = r.id
      WHERE r.codigo = 'abogado'
        AND u.creado_el >= ${sixWeeksAgo}
      GROUP BY DATE_TRUNC('week', u.creado_el)
      ORDER BY semana
    `;

    let clientesData = await prisma.$queryRaw(clientesQuery);
    let abogadosData = await prisma.$queryRaw(abogadosQuery);

    // Convertir BigInt a Number
    clientesData = clientesData.map(row => ({
      semana: row.semana,
      nuevos_clientes: Number(row.nuevos_clientes)
    }));

    abogadosData = abogadosData.map(row => ({
      semana: row.semana,
      nuevos_abogados: Number(row.nuevos_abogados)
    }));

    res.json({
      success: true,
      charts: {
        clientes: clientesData,
        abogados: abogadosData
      }
    });

  } catch (error) {
    console.error('Error obteniendo datos de gráficos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo datos de gráficos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }); 
  }
};

module.exports = {
  getStats,
  getCharts
};