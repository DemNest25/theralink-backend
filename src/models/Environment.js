// src/models/Environment.js
const mongoose = require('mongoose');

const environmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
      // ej: 'claustrophobia', 'acrophobia', 'social_anxiety'
    },
    displayName: {
      type: String,
      required: true,
      trim: true
      // ej: 'Claustrofobia', 'Acrofobia', 'Ansiedad Social'
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    difficultyLevels: {
      type: Number,
      min: 1,
      max: 5,
      default: 3 // cuántos niveles de dificultad tiene este escenario VR
    },
    isActive: {
      type: Boolean,
      default: true // para desactivar escenarios sin eliminarlos
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Environment', environmentSchema);