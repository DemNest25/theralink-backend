const Device = require('../models/Device');

const LAST_SEEN_THROTTLE_MS = 2000;

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

    // lastSeen alimenta `online`. updateOne (no save) para no disparar hooks;
    // con throttle para no escribir en cada poll.
    const now = Date.now();
    if (!device.lastSeen || now - device.lastSeen.getTime() > LAST_SEEN_THROTTLE_MS) {
      device.lastSeen = new Date(now);
      Device.updateOne({ _id: device._id }, { $set: { lastSeen: device.lastSeen } })
        .catch(err => console.error('Error actualizando lastSeen:', err.message));
    }

    req.device = device;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const requireDeviceType = (type) => (req, res, next) => {
  if (req.device.type !== type) {
    return res.status(403).json({ error: `Solo dispositivos de tipo '${type}'` });
  }
  next();
};

module.exports = { authenticateDevice, requireDeviceType };
