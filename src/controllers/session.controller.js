const Session = require('../models/Session');

// POST /api/sessions
const createSession = async (req, res) => {
  try {
    const { patient, therapist, environment, startTime } = req.body;

    const session = await Session.create({
      patient,
      therapist,
      environment,
      startTime
    });

    res.status(201).json({ message: 'Sesión creada', session });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// GET /api/sessions
const getSessions = async (req, res) => {
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
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// GET /api/sessions/:id
const getSessionById = async (req, res) => {
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
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// PATCH /api/sessions/:id
const updateSession = async (req, res) => {
  try {
    const allowed = ['status', 'anxietyLevel', 'therapistNotes', 'endTime'];
    const updates = {};

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Si se está cerrando la sesión, calcular duración automáticamente
    if (updates.status === 'completed' || updates.status === 'interrupted') {
      const session = await Session.findById(req.params.id);
      if (session) {
        updates.endTime = updates.endTime || new Date();
        updates.durationMinutes = Math.round(
          (new Date(updates.endTime) - session.startTime) / 60000
        );
      }
    }

    const session = await Session.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.json({ message: 'Sesión actualizada', session });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// DELETE /api/sessions/:id
const deleteSession = async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.json({ message: 'Sesión eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

module.exports = { createSession, getSessions, getSessionById, updateSession, deleteSession };