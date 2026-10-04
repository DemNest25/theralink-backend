// scripts/seedScenarios.js
// Upsert idempotente de los escenarios (niveles) desde scripts/data/scenarios.json.
// Requiere los Environments (npm run seed:environments) y los mapName reales de
// UE5 (formato /Game/...) en lugar de "COMPLETAR". Aborta sin escribir nada si
// falta alguno.
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const Environment = require('../src/models/Environment');
const Scenario = require('../src/models/Scenario');
const scenarios = require('./data/scenarios.json');

// Valida scripts/data/scenarios.json sin tocar la base: lanza si falta un mapName
function assertScenarioData() {
  const pending = scenarios.filter(s => !s.mapName || s.mapName.trim() === 'COMPLETAR');
  if (pending.length > 0) {
    const list = pending.map(s => `  - ${s.key} (sugerido: ${s.mapNameHint || '?'})`).join('\n');
    throw new Error(`Abortado: faltan mapName reales en scripts/data/scenarios.json para:\n${list}`);
  }
}

// Requiere una conexión de mongoose abierta (la reutiliza seedCloud.js)
async function seedScenarios() {
  assertScenarioData();

  // Resolver todos los Environments antes de escribir nada
  const envByName = {};
  for (const name of [...new Set(scenarios.map(s => s.phobia))]) {
    const env = await Environment.findOne({ name });
    if (!env) {
      throw new Error(`Abortado: no existe el Environment '${name}'. Corre npm run seed:environments primero.`);
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
}

module.exports = { seedScenarios, assertScenarioData };

if (require.main === module) {
  Promise.resolve()
    .then(assertScenarioData)
    .then(() => mongoose.connect(mongoUri))
    .then(seedScenarios)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.message.startsWith('Abortado') ? err.message : err);
      process.exit(1);
    });
}
