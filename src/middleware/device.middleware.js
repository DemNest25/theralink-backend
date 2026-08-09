const Device = require('../models/Device');

const authenticateDevice = async (req, res, next) => {
  const apiKey = req.headers['x-device-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key requerida' });
  }

  try {
    const device = await Device.findOne({ apiKey, active: true });

    if (!device) {
      return res.status(403).json({ error: 'Dispositivo no autorizado' });
    }

    req.device = device;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { authenticateDevice };
