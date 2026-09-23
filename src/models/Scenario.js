// src/models/Scenario.js
const mongoose = require('mongoose');

const scenarioSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Fobia a la que pertenece este nivel — referencia al Environment, no un enum propio
    environment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
      required: true
    },
    mapName: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: 3
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Para listar los niveles de una fobia en orden de jerarquía de exposición
scenarioSchema.index({ environment: 1, order: 1 });

module.exports = mongoose.model('Scenario', scenarioSchema);
