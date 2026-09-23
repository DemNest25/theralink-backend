// src/models/Device.js
const mongoose = require('mongoose');

const ONLINE_THRESHOLD_MS = 10 * 1000;

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true // serial del Watch o del Quest (ej. "quest-01")
    },
    type: {
      type: String,
      enum: ['quest', 'watch'],
      required: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    // Solo lo usa el watch, y puede estar sin vincular: se vincula al iniciar
    // una sesión (POST /sessions/:id/start). El Quest nunca lo usa.
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    apiKey: {
      type: String,
      required: true,
      unique: true
    },
    active: {
      type: Boolean,
      default: true
    },
    lastSeen: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

deviceSchema.virtual('online').get(function() {
  return !!this.lastSeen && (Date.now() - this.lastSeen.getTime()) < ONLINE_THRESHOLD_MS;
});

// Si el Device está vinculado a un patient, debe ser un User con role: 'patient'
deviceSchema.pre('save', async function() {
  if (!this.isModified('patient') || !this.patient) return;

  const User = mongoose.model('User');
  const patient = await User.findById(this.patient);

  if (!patient) {
    throw new Error('El patient referenciado no existe');
  }
  if (patient.role !== 'patient') {
    throw new Error(`El usuario referenciado debe tener role 'patient' (tiene '${patient.role}')`);
  }
});

module.exports = mongoose.model('Device', deviceSchema);
