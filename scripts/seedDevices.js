// scripts/seedDevices.js
// Upsert de los dispositivos base. La apiKey se genera solo al crear el
// dispositivo; si ya existe se conserva (el reloj / UE5 ya la tienen
// configurada) junto con su patient.
const crypto = require('crypto');
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const Device = require('../src/models/Device');

const DEVICES = [
  { deviceId: 'quest-01',       type: 'quest', name: 'Meta Quest 1' },
  { deviceId: 'WATCH-TEST-001', type: 'watch', name: 'Galaxy Watch 1' }
];

// Requiere una conexión de mongoose abierta (la reutiliza seedCloud.js).
// Devuelve los dispositivos con su apiKey: cada base genera las suyas, así las
// de la nube nunca coinciden con las locales.
async function seedDevices() {
  const result = [];
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
    result.push({ deviceId: device.deviceId, type: device.type, name: device.name, apiKey: device.apiKey, created: !existed });
  }
  return result;
}

module.exports = { seedDevices };

if (require.main === module) {
  mongoose.connect(mongoUri)
    .then(seedDevices)
    .then((devices) => {
      devices.forEach(d => console.log(`  ${d.deviceId} apiKey: ${d.apiKey}`));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error en seed de dispositivos:', err);
      process.exit(1);
    });
}
