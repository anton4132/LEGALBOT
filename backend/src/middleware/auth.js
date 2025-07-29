const { prisma } = require('../config/database');

// Middleware para verificar autenticación
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    // Aquí puedes implementar verificación de JWT
    // Por ahora, asumimos que el token es válido
    // En producción, deberías verificar el token JWT
    
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Middleware para verificar rol admin
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id; // Asumiendo que el usuario está en req.user
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user || user.role.codigo !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    next();
  } catch (error) {
    console.error('Error verificando rol admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  authenticateUser,
  requireAdmin
};