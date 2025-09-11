const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Verifica el JWT y construye req.ctx
const authenticate = (requiredScope = 'full') => (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Token de autenticación requerido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);

    if (requiredScope && payload.scope !== requiredScope) {
      return res.status(403).json({ message: 'Scope inválido' });
    }

    req.ctx = {
      personaId: payload.personaId,
      usuarioId: payload.usuarioId,
      rolId: payload.rolId
    };
    req.tokenScope = payload.scope;

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(401).json({ message: 'Token inválido' });
  }
};

// Guard para roles permitidos
const requireRole = (...rolesPermitidos) => (req, res, next) => {
  if (!req.ctx || !rolesPermitidos.includes(req.ctx.rolId)) {
    return res.status(403).end();
  }
  next();
};

module.exports = {
  authenticate,
  requireRole
};