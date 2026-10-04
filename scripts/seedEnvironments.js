// scripts/seedEnvironments.js
// Upsert de los 3 Environments (fobias) que usa la jerarquía de exposición.
// Cualquier otro Environment que ya exista en la BD queda con isActive:false
// (no se borra, por si hay Sessions viejas que lo referencian).
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const Environment = require('../src/models/Environment');

const TARGET_ENVIRONMENTS = [
  {
    name: 'nictofobia',
    displayName: 'Nictofobia',
    description: 'Miedo a la oscuridad',
    difficultyLevels: 3
  },
  {
    name: 'claustrofobia',
    displayName: 'Claustrofobia',
    description: 'Miedo a espacios cerrados',
    difficultyLevels: 3
  },
  {
    name: 'aracnofobia',
    displayName: 'Aracnofobia',
    description: 'Miedo a las arañas',
    difficultyLevels: 3
  }
];

// Requiere una conexión de mongoose abierta (la reutiliza seedCloud.js)
async function seedEnvironments() {
  for (const env of TARGET_ENVIRONMENTS) {
    const result = await Environment.findOneAndUpdate(
      { name: env.name },
      { $set: { ...env, isActive: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );
    console.log(`✓ ${result.name} → ${result._id}`);
  }

  const targetNames = TARGET_ENVIRONMENTS.map(e => e.name);
  const deactivated = await Environment.updateMany(
    { name: { $nin: targetNames } },
    { $set: { isActive: false } }
  );
  console.log(`Desactivados (fuera del catálogo nuevo): ${deactivated.modifiedCount}`);
}

module.exports = { seedEnvironments };

if (require.main === module) {
  mongoose.connect(mongoUri)
    .then(seedEnvironments)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error en seed de environments:', err);
      process.exit(1);
    });
}
