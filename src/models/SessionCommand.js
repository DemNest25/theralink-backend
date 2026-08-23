// src/models/SessionCommand.js
const mongoose = require('mongoose');

const sessionCommandSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    commandType: {
      type: String,
      required: true,
      enum: [
        // Ascensor
        'elevator_wall_material',   // vidrio ↔ metal por pared individual
        // Vestidor
        'dressing_room_light',      // encendida / intermitente / apagada
        // Aracnofobia Niveles 1 y 2
        'spider_movement',          // activar/desactivar movimiento
        'spider_count',             // cantidad de arañas (1–10)
        // General
        'session_pause',            // pausa de emergencia
        'session_resume'            // reanudar
      ]
    },
    payload: {
      type: mongoose.Schema.Types.Mixed, // objeto flexible según commandType
      default: {}
    },
    status: {
      type: String,
      enum: ['pending', 'executed', 'cancelled'],
      default: 'pending'
    },
    executedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Índice para que UE5 consulte rápido los comandos pendientes
sessionCommandSchema.index({ session: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('SessionCommand', sessionCommandSchema);