const { prisma } = require('../config/database');

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

    // Clientes
    let clientesData = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE_TRUNC('week', u.creado_el)::DATE as semana,
        COUNT(*)::bigint as nuevos_clientes
      FROM "usuario" u
      JOIN "role" r ON u.rol_id = r.id
      WHERE r.codigo = 'cliente'
        AND u.creado_el >= $1
      GROUP BY DATE_TRUNC('week', u.creado_el)
      ORDER BY semana
    `, sixWeeksAgo);

    // Abogados
    let abogadosData = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE_TRUNC('week', u.creado_el)::DATE as semana,
        COUNT(*)::bigint as nuevos_abogados
      FROM "usuario" u
      JOIN "role" r ON u.rol_id = r.id
      WHERE r.codigo = 'abogado'
        AND u.creado_el >= $1
      GROUP BY DATE_TRUNC('week', u.creado_el)
      ORDER BY semana
    `, sixWeeksAgo);

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