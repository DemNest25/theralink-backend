const Biometric = require('../models/Biometric');
const Session = require('../models/Session');
const mongoose = require('mongoose');

// POST /api/biometrics
const createBiometric = async (req, res, next) => {
  try {
    const {
      session, patient, heartRate, ibi, hrv,
      eda, ppgGreen, ppgRed, ppgInfrared,
      skinTemperature, stressIndex, timestamp
    } = req.body;

    const biometric = await Biometric.create({
      session, patient, heartRate, ibi, hrv,
      eda, ppgGreen, ppgRed, ppgInfrared,
      skinTemperature, stressIndex, timestamp
    });

    res.status(201).json({ message: 'Lectura biométrica registrada', biometric });
  } catch (err) {
    next(err);
  }
};

// GET /api/biometrics/session/:sessionId
const getBiometricsBySession = async (req, res, next) => {
  try {
    const biometrics = await Biometric.find({ session: req.params.sessionId })
      .sort({ timestamp: 1 }); // orden cronológico

    res.json(biometrics);
  } catch (err) {
    next(err);
  }
};

// GET /api/biometrics/session/:sessionId/summary
const getBiometricSummary = async (req, res, next) => {
  try {
    const result = await Biometric.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(req.params.sessionId) } },
      {
        $group: {
          _id: '$session',
          avgHeartRate:      { $avg: '$heartRate' },
          maxHeartRate:      { $max: '$heartRate' },
          minHeartRate:      { $min: '$heartRate' },
          avgHrv:            { $avg: '$hrv' },
          avgIbi:            { $avg: '$ibi' },
          avgEda:            { $avg: '$eda' },         // ← nuevo
          maxEda:            { $max: '$eda' },         // ← pico de activación
          avgSkinTemp:       { $avg: '$skinTemperature' }, // ← nuevo
          avgStressIndex:    { $avg: '$stressIndex' },
          totalReadings:     { $sum: 1 }
        }
      }
    ]);

    if (!result.length) {
      return res.status(404).json({ message: 'No hay datos biométricos para esta sesión' });
    }

    // Redondear a 2 decimales
    const summary = result[0];
    Object.keys(summary).forEach(key => {
      if (typeof summary[key] === 'number') {
        summary[key] = Math.round(summary[key] * 100) / 100;
      }
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
};

// POST /api/biometrics/:sessionId — ingesta por lote desde el Watch (auth por API key de dispositivo)
const ingestReadings = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { readings } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    if (session.patient.toString() !== req.device.patient.toString()) {
      return res.status(403).json({ error: 'Sesión no corresponde a este dispositivo' });
    }

    const docs = readings.map(reading => ({
      ...reading,
      session: sessionId,
      patient: req.device.patient,
      deviceId: req.device.deviceId
    }));

    const inserted = await Biometric.insertMany(docs);

    res.status(201).json({ inserted: inserted.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBiometric, getBiometricsBySession, getBiometricSummary, ingestReadings };