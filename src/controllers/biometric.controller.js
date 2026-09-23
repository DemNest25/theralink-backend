const Biometric = require('../models/Biometric');
const Session = require('../models/Session');
const mongoose = require('mongoose');
const { loadOwnedSession } = require('../utils/ownership');

// GET /api/biometrics/session/:sessionId
const getBiometricsBySession = async (req, res, next) => {
  try {
    await loadOwnedSession(req.params.sessionId, req.user.id);

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
    await loadOwnedSession(req.params.sessionId, req.user.id);

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

    if (!req.device.patient) {
      return res.status(403).json({ error: 'Dispositivo sin paciente vinculado' });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ message: 'readings debe ser un arreglo no vacío' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    if (session.patient.toString() !== req.device.patient.toString()) {
      return res.status(403).json({ error: 'Sesión no corresponde a este dispositivo' });
    }

    if (!['en_curso', 'pausada'].includes(session.status)) {
      return res.status(409).json({ message: 'La sesión no está activa', code: 'SESSION_CLOSED' });
    }

    // Entradas que no son objetos cuentan como rechazadas (no se insertan vacías)
    const validShape = readings.filter(r => r && typeof r === 'object' && !Array.isArray(r));

    const docs = validShape.map(reading => ({
      ...reading,
      session: sessionId,
      patient: req.device.patient,
      deviceId: req.device.deviceId
    }));

    // ordered:false → las lecturas que fallan validación (fuera de rango) se
    // descartan y el resto se inserta; devuelve solo las insertadas.
    const inserted = docs.length > 0
      ? await Biometric.insertMany(docs, { ordered: false })
      : [];
    const rejected = readings.length - inserted.length;

    if (inserted.length === 0 && rejected > 0) {
      return res.status(400).json({ message: 'Ninguna lectura válida en el lote', rejected });
    }

    res.status(201).json({ inserted: inserted.length, rejected });
  } catch (err) {
    next(err);
  }
};

module.exports = { getBiometricsBySession, getBiometricSummary, ingestReadings };