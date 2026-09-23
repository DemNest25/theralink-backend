// scripts/seedDevices.js
// Upsert de los dispositivos base. La apiKey se genera solo al crear el
// dispositivo; si ya existe se conserva (el reloj / UE5 ya la tienen
// configurada) junto con su patient.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Device = require('../src/models/Device');

const DEVICES = [
  { deviceId: 'quest-01',       type: 'quest', name: 'Meta Quest 1' },
  { deviceId: 'WATCH-TEST-001', type: 'watch', name: 'Galaxy Watch 1' }
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const d of DEVICES) {
    const existed = await Device.exists({ deviceId: d.deviceId });

    const device = await Device.findOneAndUpdate(
      { deviceId: d.deviceId },
      {
        $set: { type: d.type, name: d.name },
        $setOnInsert: { apiKey: crypto.randomBytes(24).toString('hex'), active: true }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    console.log(`${existed ? '= existente' : '+ creado'}  ${device.deviceId}  (${device.type})`);
    console.log(`  apiKey: ${device.apiKey}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Error en seed de dispositivos:', err);
  process.exit(1);
});
