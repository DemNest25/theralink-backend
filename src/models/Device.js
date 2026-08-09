// src/models/Device.js
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true // serial del Watch
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    apiKey: {
      type: String,
      required: true,
      unique: true
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

// El Device solo puede vincularse a un User con role: 'patient'
deviceSchema.pre('save', async function() {
  if (!this.isModified('patient')) return;

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
