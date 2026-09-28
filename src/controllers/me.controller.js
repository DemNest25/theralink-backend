// src/controllers/me.controller.js
// Portal del paciente. Todo se filtra por req.user.id (nunca por un id recibido)
// y las respuestas se arman campo por campo: lo que no está aquí no sale. Las
// notas del terapeuta y los datos clínicos internos no se exponen.
const User = require('../models/User');
const Session = require('../models/Session');
const Scenario = require('../models/Scenario');

const scenarioSummary = (s) => (s ? { key: s.key, name: s.name, order: s.order } : null);

// Filtro del paciente del token con cuenta vigente (desactivada o borrada → 401)
const activePatient = (req) => ({ _id: req.user.id, role: 'patient', isActive: { $ne: false } });
const unavailable = (res) => res.status(401).json({ message: 'Cuenta no disponible' });

// GET /api/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findOne(activePatient(req))
      .select('name email createdAt phobia assignedTherapist safePlace.name')
      .populate('phobia', 'name displayName')
      .populate('assignedTherapist', 'name')
      .lean();

    // Token válido pero cuenta desactivada o borrada: igual que el login
    if (!user) return unavailable(res);

    const scenarios = user.phobia
      ? await Scenario.find({ environment: user.phobia._id, active: true })
          .sort({ order: 1 })
          .select('key name order')
          .lean()
      : [];

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      phobia: user.phobia ? { name: user.phobia.name, displayName: user.phobia.displayName } : null,
      therapist: user.assignedTherapist ? { name: user.assignedTherapist.name } : null,
      safePlace: { name: user.safePlace?.name ?? '' },
      scenarios: scenarios.map(scenarioSummary)
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/me/sessions — historial (solo finalizadas) + conteo de programadas
const getMySessions = async (req, res, next) => {
  try {
    if (!(await User.exists(activePatient(req)))) return unavailable(res);

    const [sessions, upcomingCount] = await Promise.all([
      Session.find({ patient: req.user.id, status: 'finalizada' })
        .sort({ startTime: -1 })
        .select('startTime endTime durationMinutes anxietyLevel scenario')
        .populate('scenario', 'key name order')
        .lean(),
      Session.countDocuments({ patient: req.user.id, status: 'programada' })
    ]);

    res.json({
      sessions: sessions.map(s => ({
        _id: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        anxietyLevel: s.anxietyLevel,
        scenario: scenarioSummary(s.scenario)
      })),
      upcomingCount
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, getMySessions };
