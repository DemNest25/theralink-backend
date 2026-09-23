const Scenario = require('../models/Scenario');
const Device = require('../models/Device');

// GET /api/scenarios?environment=<id> — escenarios activos por order
const getScenarios = async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.query.environment) filter.environment = req.query.environment;

    const scenarios = await Scenario.find(filter)
      .sort(req.query.environment ? { order: 1 } : { environment: 1, order: 1 });

    res.json(scenarios);
  } catch (err) {
    next(err);
  }
};

// GET /api/devices — nunca incluye apiKey
const getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find({})
      .select('deviceId type name lastSeen patient')
      .populate('patient', 'name')
      .sort({ type: 1, deviceId: 1 });

    res.json(devices);
  } catch (err) {
    next(err);
  }
};

module.exports = { getScenarios, getDevices };
