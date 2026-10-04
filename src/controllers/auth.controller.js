const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { INACTIVE_ACCOUNT } = require('../middleware/auth.middleware');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

// POST /api/auth/register
// Deshabilitado para todos los roles: therapist/admin se crean por seed
// (npm run seed:therapist / seed:admin), patient por POST /api/patients
// (terapeuta autenticado). Nunca por auto-registro.
const register = (req, res) => {
  res.status(410).json({
    message: "Registro deshabilitado. Las cuentas de therapist/admin se crean por seed y las de patient por POST /api/patients."
  });
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // La contraseña se verifica antes de mirar el estado: sin ella no se revela
    // si una cuenta ajena está dada de baja
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (user.isActive === false) {
      // Paciente dado de baja: mensaje propio; staff inactivo, igual que antes
      return user.role === 'patient'
        ? res.status(403).json(INACTIVE_ACCOUNT)
        : res.status(401).json({ message: 'Credenciales inválidas' });
    }

    res.json({
      token: generateToken(user),
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };