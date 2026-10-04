const mongoose = require('mongoose');
const User = require('../models/User');
const Environment = require('../models/Environment');
const Session = require('../models/Session');
const { closeSession, patientHasActiveSession } = require('../utils/sessionLifecycle');
const { emitSessionStatus } = require('../realtime/io');

const { DEACTIVATION_REASONS, DEACTIVATION_NOTE_MAX } = User;

// Misma regla que el esquema (minlength 8), validada a mano para que el 400 no
// repita la contraseña recibida (el mensaje de Mongoose incluye el valor)
const PASSWORD_RULE = 'password es requerido y debe tener al menos 8 caracteres';
const isValidPassword = (password) => typeof password === 'string' && password.length >= 8;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Único lugar que decide qué pacientes ve cada rol: el terapeuta solo los suyos
// (si no, 404 sin revelar que existe); el admin, cualquiera.
const patientFilter = (req, id) => ({
  ...(id ? { _id: id } : {}),
  role: 'patient',
  ...(req.user.role === 'admin' ? {} : { assignedTherapist: req.user.id })
});

// Filtro de ?status= en GET /api/patients (documentos sin isActive cuentan como activos)
const STATUS_FILTERS = {
  activo: { isActive: { $ne: false } },
  inactivo: { isActive: false },
  todos: {}
};

// Campos editables en PATCH /api/patients/:id
const EDITABLE_FIELDS = ['name', 'email', 'phobia'];

const PACIENTE_INACTIVO = 'PACIENTE_INACTIVO';
const notFound = (res) => res.status(404).json({ message: 'Paciente no encontrado' });
const inactiveConflict = (res, action) =>
  res.status(409).json({ code: PACIENTE_INACTIVO, message: `El paciente está dado de baja; reactívalo para ${action}` });

// Respuesta de un paciente: sin password y con `status` legible junto a isActive
function serializePatient(patient) {
  const p = typeof patient.toObject === 'function' ? patient.toObject() : { ...patient };
  delete p.password;
  p.isActive = p.isActive !== false;
  p.status = p.isActive ? 'activo' : 'inactivo';
  return p;
}

// phobia debe ser un ObjectId de un Environment activo (mismas reglas que al crear).
// Devuelve el mensaje del 400 o null si es válida.
async function phobiaError(phobia) {
  if (!phobia || !mongoose.Types.ObjectId.isValid(phobia)) {
    return 'phobia es requerido y debe ser un ObjectId válido de Environment';
  }
  const environment = await Environment.exists({ _id: phobia, isActive: true });
  return environment ? null : 'phobia debe referenciar un Environment activo existente';
}

// POST /api/patients — solo therapist (ver patient.routes.js). assignedTherapist = req.user.id
const createPatient = async (req, res, next) => {
  try {
    const { name, password, phobia } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: PASSWORD_RULE });
    }

    const invalidPhobia = await phobiaError(phobia);
    if (invalidPhobia) {
      return res.status(400).json({ message: invalidPhobia });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const patient = await User.create({
      name,
      email,
      password,
      role: 'patient',
      phobia,
      assignedTherapist: req.user.id
    });

    res.status(201).json({
      message: 'Paciente creado',
      patient: {
        _id: patient._id,
        id: patient._id,
        name: patient.name,
        email: patient.email,
        phobia: patient.phobia,
        assignedTherapist: patient.assignedTherapist
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/patients?status=activo|inactivo|todos (default activo)
// Responde un arreglo (como siempre). Con ?withCounts=true responde
// { patients, counts: { activos, inactivos } }.
const getPatients = async (req, res, next) => {
  try {
    const status = req.query.status || 'activo';
    if (!STATUS_FILTERS[status]) {
      return res.status(400).json({ message: "status debe ser 'activo', 'inactivo' o 'todos'" });
    }

    const base = patientFilter(req);
    const patients = await User.find({ ...base, ...STATUS_FILTERS[status] })
      .select('-password')
      .populate('phobia', 'name displayName')
      .lean();
    const list = patients.map(serializePatient);

    if (req.query.withCounts !== 'true') {
      return res.json(list);
    }

    const [activos, inactivos] = await Promise.all([
      User.countDocuments({ ...base, ...STATUS_FILTERS.activo }),
      User.countDocuments({ ...base, ...STATUS_FILTERS.inactivo })
    ]);
    res.json({ patients: list, counts: { activos, inactivos } });
  } catch (err) {
    next(err);
  }
};

// GET /api/patients/:id — perfil de un paciente propio
const getPatientById = async (req, res, next) => {
  try {
    const patient = await User.findOne(patientFilter(req, req.params.id))
      .select('-password')
      .populate('phobia', 'name displayName')
      .lean();

    if (!patient) {
      return notFound(res);
    }

    res.json(serializePatient(patient));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/patients/:id  { name?, email?, phobia? }
// Cualquier otro campo (password, role, status, isActive, _id…) → 400.
const updatePatient = async (req, res, next) => {
  try {
    const body = req.body || {};
    const notEditable = Object.keys(body).filter(k => !EDITABLE_FIELDS.includes(k));
    if (notEditable.length > 0) {
      return res.status(400).json({
        message: `Campos no editables: ${notEditable.join(', ')}. Solo se permiten ${EDITABLE_FIELDS.join(', ')}.`
      });
    }

    const patient = await User.findOne(patientFilter(req, req.params.id));
    if (!patient) {
      return notFound(res);
    }
    if (patient.isActive === false) {
      return inactiveConflict(res, 'editarlo');
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return res.status(400).json({ message: 'El nombre no puede quedar vacío' });
      }
      patient.name = name;
    }

    if (body.email !== undefined) {
      const email = normalizeEmail(body.email);
      if (!email) {
        return res.status(400).json({ message: 'El email no puede quedar vacío' });
      }
      if (email !== patient.email) {
        if (await User.exists({ email, _id: { $ne: patient._id } })) {
          return res.status(409).json({ message: 'El email ya está registrado' });
        }
        patient.email = email;
      }
    }

    // Cada sesión guarda su propio environment (y su scenario al iniciar), así que
    // cambiar la fobia no altera el historial. Solo se bloquea con una sesión abierta;
    // las programadas (sin escenario todavía) pasan a la fobia nueva.
    let reassignedSessions = 0;
    const phobiaChanged = body.phobia !== undefined && String(body.phobia) !== String(patient.phobia);
    if (phobiaChanged) {
      const invalidPhobia = await phobiaError(body.phobia);
      if (invalidPhobia) {
        return res.status(400).json({ message: invalidPhobia });
      }
      if (await patientHasActiveSession(patient._id)) {
        return res.status(409).json({
          code: 'SESION_ACTIVA',
          message: 'No se puede cambiar la fobia mientras el paciente tiene una sesión cargando, en curso o en pausa'
        });
      }
      patient.phobia = body.phobia;
    }

    await patient.save({ validateModifiedOnly: true });

    if (phobiaChanged) {
      const result = await Session.updateMany(
        { patient: patient._id, status: 'programada' },
        { $set: { environment: patient.phobia } }
      );
      reassignedSessions = result.modifiedCount;
    }

    await patient.populate('phobia', 'name displayName');
    res.json({ message: 'Paciente actualizado', patient: serializePatient(patient), reassignedSessions });
  } catch (err) {
    // Carrera con el índice único de email
    if (err.code === 11000) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    next(err);
  }
};

// PATCH /api/patients/:id/deactivate  { reason, note? }
// Baja lógica: el paciente ya no puede entrar al portal, sus sesiones programadas
// se cancelan y el historial se conserva.
const deactivatePatient = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const note = req.body?.note == null ? '' : String(req.body.note).trim();

    if (!DEACTIVATION_REASONS.includes(reason)) {
      return res.status(400).json({ message: `reason es requerido y debe ser uno de: ${DEACTIVATION_REASONS.join(', ')}` });
    }
    if (note.length > DEACTIVATION_NOTE_MAX) {
      return res.status(400).json({ message: `La nota admite como máximo ${DEACTIVATION_NOTE_MAX} caracteres` });
    }

    const patient = await User.findOne(patientFilter(req, req.params.id));
    if (!patient) {
      return notFound(res);
    }
    if (patient.isActive === false) {
      return res.status(409).json({ code: PACIENTE_INACTIVO, message: 'El paciente ya está dado de baja' });
    }
    if (await patientHasActiveSession(patient._id)) {
      return res.status(409).json({
        code: 'SESION_ACTIVA',
        message: 'El paciente tiene una sesión cargando, en curso o en pausa'
      });
    }

    // Primero la baja (así no se le pueden crear sesiones nuevas), luego las cancelaciones
    patient.isActive = false;
    patient.deactivatedAt = new Date();
    patient.deactivationReason = reason;
    patient.deactivationNote = note;
    patient.deactivatedBy = req.user.id;
    await patient.save({ validateModifiedOnly: true });

    const scheduled = await Session.find({ patient: patient._id, status: 'programada' });
    for (const session of scheduled) {
      session.therapistNotes = [session.therapistNotes, 'Cancelada por baja del paciente'].filter(Boolean).join('\n');
      await closeSession(session, 'cancelada');
      emitSessionStatus(session);
    }

    await patient.populate('phobia', 'name displayName');
    res.json({
      message: 'Paciente dado de baja',
      patient: serializePatient(patient),
      cancelledSessions: scheduled.length
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/patients/:id/reactivate — no restaura las sesiones canceladas
const reactivatePatient = async (req, res, next) => {
  try {
    const patient = await User.findOne(patientFilter(req, req.params.id));
    if (!patient) {
      return notFound(res);
    }
    if (patient.isActive !== false) {
      return res.status(409).json({ message: 'El paciente ya está activo' });
    }

    patient.isActive = true;
    patient.deactivatedAt = null;
    patient.deactivationReason = null;
    patient.deactivationNote = '';
    patient.deactivatedBy = null;
    await patient.save({ validateModifiedOnly: true });

    await patient.populate('phobia', 'name displayName');
    res.json({ message: 'Paciente reactivado', patient: serializePatient(patient) });
  } catch (err) {
    next(err);
  }
};

// POST /api/patients/:id/reset-password  { password } — solo el terapeuta asignado
const resetPatientPassword = async (req, res, next) => {
  try {
    const patient = await User.findOne(patientFilter(req, req.params.id));

    if (!patient) {
      return notFound(res);
    }
    if (patient.isActive === false) {
      return inactiveConflict(res, 'restablecer su contraseña');
    }

    const { password } = req.body;
    if (!isValidPassword(password)) {
      return res.status(400).json({ message: PASSWORD_RULE });
    }

    // save() (no updateOne) para que el pre-save hashee. validateModifiedOnly: un
    // documento antiguo con otro campo inválido no debe bloquear el reset.
    patient.password = password;
    await patient.save({ validateModifiedOnly: true });

    res.json({ message: 'Contraseña restablecida' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deactivatePatient,
  reactivatePatient,
  resetPatientPassword
};
