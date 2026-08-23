// src/models/Biometric.js
const mongoose = require('mongoose');

const biometricSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    deviceId: {
      type: String,    // serial del wearable que originó la lectura
      default: null
    },

    // ── Frecuencia cardíaca ──────────────────────────────
    heartRate: {
      type: Number,
      min: 30,
      max: 220,
      required: false
    },
    ibi: {
      type: Number,    // intervalo entre latidos en ms
      min: 200,
      max: 2000,
      default: null
    },
    hrv: {
      type: Number,    // variabilidad FC derivada del IBI — proxy de estrés
      default: null
    },

    // ── Actividad Electrodérmica (EDA) ───────────────────
    eda: {
      type: Number,    // conductancia de la piel en µS (microsiemens)
      min: 0,
      default: null    // sube con activación simpática → ansiedad/estrés
    },

    // ── PPG (Fotopletismografía) ─────────────────────────
    ppgGreen: {
      type: Number,    // señal raw del LED verde — FC principal
      default: null
    },
    ppgRed: {
      type: Number,    // señal raw del LED rojo — SpO2 + perfusión
      default: null
    },
    ppgInfrared: {
      type: Number,    // señal raw del LED infrarrojo — SpO2 profundo
      default: null
    },

    // ── Temperatura cutánea ──────────────────────────────
    skinTemperature: {
      type: Number,    // en °C — baja con vasoconstricción por estrés
      min: 25,
      max: 40,
      default: null
    },

    // ── Índice de estrés compuesto ───────────────────────
    stressIndex: {
      type: Number,    // calculado del IBI + EDA (0–100)
      min: 0,
      max: 100,
      default: null
    }
  },
  {
    timestamps: true // createdAt/updatedAt para auditoría de ingesta; `timestamp` sigue siendo la hora de la lectura
  }
);

// Índice compuesto para queries de dashboard
biometricSchema.index({ session: 1, timestamp: 1 });

module.exports = mongoose.model('Biometric', biometricSchema);
