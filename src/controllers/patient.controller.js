const mongoose = require('mongoose');
const User = require('../models/User');
const Environment = require('../models/Environment');

// POST /api/patients — solo therapist (ver patient.routes.js). assignedTherapist = req.user.id
const createPatient = async (req, res, next) => {
  try {
    const { name, password, phobia } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!phobia || !mongoose.Types.ObjectId.isValid(phobia)) {
      return res.status(400).json({ message: 'phobia es requerido y debe ser un ObjectId válido de Environment' });
    }

    const environment = await Environment.findOne({ _id: phobia, isActive: true });
    if (!environment) {
      return res.status(400).json({ message: 'phobia debe referenciar un Environment activo existente' });
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

// GET /api/patients — solo los pacientes del terapeuta autenticado
const getPatients = async (req, res, next) => {
  try {
    const patients = await User.find({ role: 'patient', assignedTherapist: req.user.id })
      .select('-password')
      .populate('phobia', 'name displayName');

    res.json(patients);
  } catch (err) {
    next(err);
  }
};

// GET /api/patients/:id — perfil de un paciente propio
const getPatientById = async (req, res, next) => {
  try {
    const patient = await User.findOne({
      _id: req.params.id,
      role: 'patient',
      assignedTherapist: req.user.id
    })
      .select('-password')
      .populate('phobia', 'name displayName');

    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    res.json(patient);
  } catch (err) {
    next(err);
  }
};

module.exports = { createPatient, getPatients, getPatientById };
