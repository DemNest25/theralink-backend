// scripts/migrateSessionStatus.js
// Migra datos viejos al nuevo modelo de ciclo de vida. Idempotente: solo toca
// documentos que todavía tengan el valor/forma vieja.
// 1) Session.status: active → en_curso | completed → finalizada | interrupted → cancelada
// 2) De esas, las que ya llevaban >24h sin actualizarse (abandonadas) → cancelada
// 3) Device sin `type` (creados antes de agregarlo) → type: 'watch'
require('dotenv').config();
const mongoose = require('mongoose');
const Session = require('../src/models/Session');
const Device = require('../src/models/Device');

const STATUS_MAP = {
  active: 'en_curso',
  completed: 'finalizada',
  interrupted: 'cancelada'
};

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

async function run() {
  await mongoose.connect(require('../src/config/env').mongoUri);

  // Capturar quiénes son 'active' y su updatedAt ANTES de tocarlos — updateMany
  // pisa updatedAt al migrar, así que después ya no serviría para medir abandono.
  const now = Date.now();
  const activeSessions = await Session.find({ status: 'active' }, '_id updatedAt');
  const staleIds = activeSessions
    .filter(s => now - s.updatedAt.getTime() > STALE_THRESHOLD_MS)
    .map(s => s._id);

  let totalUpdated = 0;
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const result = await Session.updateMany(
      { status: oldStatus },
      { $set: { status: newStatus } }
    );
    console.log(`${oldStatus} → ${newStatus}: ${result.modifiedCount} sesiones actualizadas`);
    totalUpdated += result.modifiedCount;
  }
  console.log(`Sesiones migradas. Total: ${totalUpdated}.`);

  let staleResult = { modifiedCount: 0 };
  if (staleIds.length > 0) {
    staleResult = await Session.updateMany(
      { _id: { $in: staleIds } },
      { $set: { status: 'cancelada' } }
    );
  }
  console.log(`Sesiones 'active' abandonadas (>24h sin actualizar) → cancelada: ${staleResult.modifiedCount}`);

  const deviceResult = await Device.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'watch' } }
  );
  console.log(`Devices sin type → 'watch': ${deviceResult.modifiedCount} actualizados`);

  process.exit(0);
}

run().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
