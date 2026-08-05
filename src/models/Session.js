// src/models/Session.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    environment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'interrupted'],
      default: 'active'
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date,
      default: null
    },
    durationMinutes: {
      type: Number,
      default: null // se calcula al cerrar sesión
    },
    anxietyLevel: {
      type: Number,
      min: 1,
      max: 10,
      default: null // reportado por el paciente al finalizar
    },
    therapistNotes: {
      type: String,
      trim: true,
      default: ''
    },
    interventionEvents: [
      {
        triggeredAt:     { type: Date, default: Date.now },
        triggerType:     { type: String, enum: ['hr_threshold', 'hrv_threshold', 'manual'] },
        hrAtTrigger:     { type: Number, default: null },
        hrvAtTrigger:    { type: Number, default: null },
        durationSeconds: { type: Number, default: null }
      }
    ]
  },
  {
    timestamps: true
  },
);

// Calcular duración automáticamente al cerrar sesión
sessionSchema.methods.close = async function(anxietyLevel, notes) {
  this.endTime = new Date();
  this.durationMinutes = Math.round(
    (this.endTime - this.startTime) / 60000
  );
  this.status = 'completed';
  if (anxietyLevel) this.anxietyLevel = anxietyLevel;
  if (notes) this.therapistNotes = notes;
  return this.save();
};

module.exports = mongoose.model('Session', sessionSchema);