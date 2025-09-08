const { prisma } = require('../config/database');

const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
    res.json(roles);
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo roles' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: parseInt(req.params.id, 10) }
    });
    if (!role) return res.status(404).json({ success: false, message: 'Rol no encontrado' });
    res.json(role);
  } catch (error) {
    console.error('Error obteniendo rol:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo rol' });
  }
};
module.exports = { getAllRoles, getRoleById };