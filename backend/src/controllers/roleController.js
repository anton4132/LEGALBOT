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

module.exports = { getAllRoles };