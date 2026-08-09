// scripts/createTestDevice.js
require('dotenv').config();
const mongoose = require('mongoose');
require('../src/models/User');
const Device = require('../src/models/Device');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const device = await Device.create({
    deviceId: 'WATCH-TEST-001',
    patient: '69d188ed84e0c6054da49f01',
    apiKey: 'test-api-key-12345',
    active: true,
  });
  console.log('Device creado:', device);
  process.exit(0);
}

run();