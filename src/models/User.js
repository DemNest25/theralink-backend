// src/models/User.js
const mongoose = require('mongoose');

const DEACTIVATION_REASONS = ['alta_terapeutica', 'abandono', 'derivacion', 'otro'];
const DEACTIVATION_NOTE_MAX = 500;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    role: {
      type: String,
      enum: ['patient', 'therapist', 'admin'],
      default: 'patient'
    },
    // Solo aplica si role === 'patient'
    assignedTherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Solo aplica si role === 'patient' — referencia al Environment (fobia) del paciente
    phobia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
      required: function() { return this.role === 'patient'; },
      default: null
    },
    anxietyThreshold: {
      hr:  { type: Number, default: 100 }, // bpm
      hrv: { type: Number, default: 40 },  // ms
      eda: { type: Number, default: 2.0 }  // µS — varía mucho por persona
    }, 
    safePlace: {
      name:        { type: String, default: '' },  // ej: "la playa de mi abuela"
      description: { type: String, default: '' }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Baja lógica del paciente (PATCH /api/patients/:id/deactivate). Se limpian al
    // reactivar; el historial clínico no se borra nunca.
    deactivatedAt: {
      type: Date,
      default: null
    },
    deactivationReason: {
      type: String,
      enum: [...DEACTIVATION_REASONS, null],
      default: null
    },
    deactivationNote: {
      type: String,
      trim: true,
      maxlength: DEACTIVATION_NOTE_MAX,
      default: ''
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true // agrega createdAt y updatedAt
  }
);

// No guardar password en texto plano — hash antes de guardar
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const bcrypt = require('bcryptjs');
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', userSchema);
module.exports.DEACTIVATION_REASONS = DEACTIVATION_REASONS;
module.exports.DEACTIVATION_NOTE_MAX = DEACTIVATION_NOTE_MAX;