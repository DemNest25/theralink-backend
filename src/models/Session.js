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
    // Nivel concreto elegido para esta sesión — se asigna en /start
    scenario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scenario',
      default: null
    },
    // Quest sobre el que corre esta sesión
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null
    },
    status: {
      type: String,
      enum: ['programada', 'cargando', 'en_curso', 'pausada', 'finalizada', 'cancelada'],
      default: 'programada'
    },
    // null al crear (status: programada). Se asigna una sola vez, la primera
    // vez que la sesión entra a en_curso (cargando → en_curso). No se toca al
    // reanudar desde pausada.
    startTime: {
      type: Date,
      default: null
    },
    // Se asigna cuando el visor confirma `end` (en_curso|pausada → finalizada/cancelada)
    endTime: {
      type: Date,
      default: null
    },
    // Intervalos de pausa dentro de la sesión, abiertos/cerrados por pause/resume
    pauses: [
      {
        start: { type: Date, required: true },
        end:   { type: Date, default: null }
      }
    ],
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

// Minutos entre startTime y endTime (o el `until` dado), descontando los
// intervalos de pauses. null si la sesión nunca llegó a en_curso (startTime null).
// Reutilizable desde el PATCH genérico y desde la confirmación de comandos del visor.
sessionSchema.methods.calculateDurationMinutes = function(until) {
  if (!this.startTime) return null;

  const end = until || this.endTime;
  if (!end) return null;

  const pausedMs = (this.pauses || []).reduce((total, p) => {
    if (!p.start) return total;
    const pauseEnd = p.end || end; // pausa que quedó abierta: cuenta hasta `end`
    return total + Math.max(0, new Date(pauseEnd) - new Date(p.start));
  }, 0);

  const totalMs = new Date(end) - new Date(this.startTime);
  return Math.round((totalMs - pausedMs) / 60000);
};

// Calcular duración automáticamente al cerrar sesión
sessionSchema.methods.close = async function(anxietyLevel, notes) {
  this.endTime = new Date();
  this.durationMinutes = this.calculateDurationMinutes(this.endTime);
  this.status = 'finalizada';
  if (anxietyLevel) this.anxietyLevel = anxietyLevel;
  if (notes) this.therapistNotes = notes;
  return this.save();
};

module.exports = mongoose.model('Session', sessionSchema);