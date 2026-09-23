// scripts/seedScenarios.js
// Upsert idempotente de los escenarios (niveles) desde scripts/data/scenarios.json.
// Requiere los Environments (npm run seed:environments) y los mapName reales de
// UE5 (formato /Game/...) en lugar de "COMPLETAR". Aborta sin escribir nada si
// falta alguno.
require('dotenv').config();
const mongoose = require('mongoose');
const Environment = require('../src/models/Environment');
const Scenario = require('../src/models/Scenario');
const scenarios = require('./data/scenarios.json');

async function run() {
  const pending = scenarios.filter(s => !s.mapName || s.mapName.trim() === 'COMPLETAR');
  if (pending.length > 0) {
    console.error('Abortado: faltan mapName reales en scripts/data/scenarios.json para:');
    pending.forEach(s => console.error(`  - ${s.key} (sugerido: ${s.mapNameHint || '?'})`));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Resolver todos los Environments antes de escribir nada
  const envByName = {};
  for (const name of [...new Set(scenarios.map(s => s.phobia))]) {
    const env = await Environment.findOne({ name });
    if (!env) {
      console.error(`Abortado: no existe el Environment '${name}'. Corre npm run seed:environments primero.`);
      process.exit(1);
    }
    envByName[name] = env;
  }

  for (const s of scenarios) {
    const doc = await Scenario.findOneAndUpdate(
      { key: s.key },
      {
        $set: {
          name: s.name,
          environment: envByName[s.phobia]._id,
          mapName: s.mapName.trim(),
          order: s.order,
          active: true
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );
    console.log(`✓ ${doc.key} (${s.phobia} #${doc.order}) → ${doc._id}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Error en seed de escenarios:', err);
  process.exit(1);
});
