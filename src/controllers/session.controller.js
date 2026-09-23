const Session = require('../models/Session');
const User = require('../models/User');
const { assertTransition, InvalidTransitionError } = require('../utils/sessionState');
const { loadOwnedSession } = require('../utils/ownership');
const { closeSession } = require('../utils/sessionLifecycle');

// POST /api/sessions
// therapist sale del JWT, no del body. environment sale de patient.phobia.
const createSession = async (req, res, next) => {
  try {
    const { patient, environment } = req.body;

    const patientUser = await User.findById(patient);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    if (patientUser.assignedTherapist && patientUser.assignedTherapist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Este paciente no está asignado a tu usuario' });
    }

    if (!patientUser.phobia) {
      return res.status(400).json({ message: 'El paciente no tiene una fobia (Environment) asignada' });
    }

    if (environment && environment !== patientUser.phobia.toString()) {
      return res.status(400).json({ message: 'El environment no coincide con la fobia del paciente' });
    }

    // startTime queda null (default del schema) hasta que la sesión entre a en_curso
    const session = await Session.create({
      patient,
      therapist: req.user.id,
      environment: patientUser.phobia
    });

    res.status(201).json({ message: 'Sesión creada', session });
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions — siempre solo las del terapeuta autenticado
const getSessions = async (req, res, next) => {
  try {
    const filter = { therapist: req.user.id };
    if (req.query.patient) filter.patient = req.query.patient;

    const sessions = await Session.find(filter)
      .populate('patient',   'name email')
      .populate('therapist', 'name email')
      .populate('environment', 'name displayName difficultyLevels')
      .populate('scenario', 'key name order')
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:id
const getSessionById = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    await session.populate([
      { path: 'patient',     select: 'name email' },
      { path: 'therapist',   select: 'name email' },
      { path: 'environment', select: 'name displayName difficultyLevels' },
      { path: 'scenario',    select: 'key name order' },
      { path: 'device',      select: 'deviceId name type' }
    ]);

    res.json(session);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/sessions/:id
// Genérico: notas/ansiedad y cierre manual (cancelada|finalizada). Iniciar,
// pausar, reanudar y terminar van por los endpoints de control de sesión.
const updateSession = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);
    const { status, anxietyLevel, therapistNotes } = req.body;

    if (status !== undefined) {
      if (!['cancelada', 'finalizada'].includes(status)) {
        return res.status(400).json({ message: 'Usa los endpoints de control de sesión' });
      }

      try {
        assertTransition(session.status, status);
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          return res.status(err.status).json({ message: err.message });
        }
        throw err;
      }
    }

    if (anxietyLevel !== undefined) session.anxietyLevel = anxietyLevel;
    if (therapistNotes !== undefined) session.therapistNotes = therapistNotes;

    if (status !== undefined) {
      await closeSession(session, status); // valida y guarda todo
    } else {
      await session.save();
    }

    res.json({ message: 'Sesión actualizada', session });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sessions/:id
const deleteSession = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    if (!['programada', 'cancelada'].includes(session.status)) {
      return res.status(409).json({
        message: 'Las sesiones realizadas son registro clínico y no se eliminan'
      });
    }

    await session.deleteOne();

    res.json({ message: 'Sesión eliminada' });
  } catch (err) {
    next(err);
  }
};

const getActiveSessionForDevice = async (req, res, next) => {
  try {
    // Contrato del reloj: "sin sesión" se detecta por el 404, no por el cuerpo.
    // Un device sin patient (watch sin vincular) tampoco tiene sesión.
    if (!req.device.patient) {
      return res.status(404).json({ message: 'No hay sesión activa para este paciente' });
    }

    const session = await Session.findOne({
      patient: req.device.patient,
      status: { $in: ['en_curso', 'pausada'] }
    })
      .sort({ startTime: -1 })
      .populate('environment', 'displayName');

    if (!session) {
      return res.status(404).json({ message: 'No hay sesión activa para este paciente' });
    }

    // `environment` debe seguir siendo un string (el reloj lo parsea como String?).
    res.json({
      sessionId: session._id,
      environment: String(session.populated('environment') ?? session.environment),
      environmentName: session.environment?.displayName ?? null,
      status: session.status,
      startTime: session.startTime
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSession, getSessions, getSessionById, updateSession, deleteSession, getActiveSessionForDevice };
