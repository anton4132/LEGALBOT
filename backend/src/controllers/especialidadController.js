// controllers/especialidadController.js
// controllers/especialidadController.js
const { prisma } = require('../config/database');

exports.getAllEspecialidades = async (req, res) => {
  try {
    const rows = await prisma.especialidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(rows);
  } catch (err) {
    console.error('GET /especialidades error:', err);
    res.status(500).json({ message: 'Error listando especialidades' });
  }
};
