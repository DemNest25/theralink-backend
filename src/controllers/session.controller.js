const Session = require('../models/Session');
const User = require('../models/User');
const { assertTransition, InvalidTransitionError } = require('../utils/sessionState');

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

// GET /api/sessions
const getSessions = async (req, res, next) => {
  try {
    const { patient, therapist } = req.query;
    const filter = {};

    if (patient)   filter.patient   = patient;
    if (therapist) filter.therapist = therapist;

    const sessions = await Session.find(filter)
      .populate('patient',   'name email')
      .populate('therapist', 'name email')
      .populate('environment', 'name displayName difficultyLevels')
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:id
const getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('patient',   'name email')
      .populate('therapist', 'name email')
      .populate('environment', 'name displayName difficultyLevels');

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/sessions/:id
const updateSession = async (req, res, next) => {
  try {
    const allowed = ['status', 'anxietyLevel', 'therapistNotes', 'endTime'];
    const updates = {};

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.status !== undefined) {
      const current = await Session.findById(req.params.id);
      if (!current) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
      }

      try {
        assertTransition(current.status, updates.status);
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          return res.status(err.status).json({ message: err.message });
        }
        throw err;
      }

      // Un paciente no puede tener más de una sesión cargando/en_curso/pausada a la vez
      if (updates.status === 'cargando') {
        const conflicting = await Session.findOne({
          _id: { $ne: current._id },
          patient: current.patient,
          status: { $in: ['cargando', 'en_curso', 'pausada'] }
        });

        if (conflicting) {
          return res.status(409).json({ message: 'El paciente ya tiene otra sesión cargando, en curso o en pausa' });
        }
      }

      // Primera vez que entra a en_curso (cargando → en_curso); al reanudar
      // desde pausada, startTime ya está seteado y no se toca.
      if (updates.status === 'en_curso' && !current.startTime) {
        updates.startTime = new Date();
      }

      // Al cerrar la sesión, calcular duración descontando los intervalos de pauses
      if (updates.status === 'finalizada' || updates.status === 'cancelada') {
        updates.endTime = updates.endTime || new Date();
        updates.durationMinutes = current.calculateDurationMinutes(updates.endTime);
      }
    }

    const session = await Session.findByIdAndUpdate(
      req.params.id,
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.json({ message: 'Sesión actualizada', session });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sessions/:id
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

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