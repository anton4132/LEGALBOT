const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Verifica el JWT y construye req.ctx
const authenticate = (requiredScope = 'full') => (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      token = parts.length === 2 ? parts[1] : parts[0];
    } else if (req.body && req.body.token) {
      token = req.body.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Token de autenticación requerido' });
    }

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
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
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