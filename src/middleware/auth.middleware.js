const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

// Mismo cuerpo que el 403 del login: el frontend cierra la sesión al recibirlo
const INACTIVE_ACCOUNT = {
  code: 'CUENTA_INACTIVA',
  message: 'Tu cuenta está inactiva. Comunícate con tu terapeuta.'
};

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado, token requerido' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }

  // Un paciente dado de baja pierde el acceso aunque su token siga vigente
  if (decoded.role === 'patient') {
    try {
      const user = await User.findById(decoded.id).select('isActive').lean();
      if (!user) {
        return res.status(401).json({ message: 'Cuenta no disponible' });
      }
      if (user.isActive === false) {
        return res.status(403).json(INACTIVE_ACCOUNT);
      }
    } catch (err) {
      return next(err);
    }
  }

  req.user = decoded; // { id, role } disponible en todos los controllers
  next();
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permiso para esta acción' });
  }
  next();
};

module.exports = { protect, restrictTo, INACTIVE_ACCOUNT };
