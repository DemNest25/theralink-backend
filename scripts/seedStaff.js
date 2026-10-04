// scripts/seedStaff.js
// Crea una cuenta de therapist o admin. Es el único lugar donde se crean estas
// cuentas ahora que /api/auth/register está deshabilitado para todos los roles.
// Idempotente: si el email ya existe, no lo duplica.
//
// Uso (los valores nunca van hardcodeados en el repo):
//   npm run seed:therapist -- --name="Dra. Pérez" --email=perez@theralink.com --password=xxxxxxxx
//   npm run seed:admin     -- --name="Admin" --email=admin@theralink.com --password=xxxxxxxx
// o por variables de entorno: STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD, STAFF_ROLE
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const User = require('../src/models/User');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

async function run() {
  const args = parseArgs();

  const role = args.role || process.env.STAFF_ROLE || 'therapist';
  const name = args.name || process.env.STAFF_NAME;
  const email = args.email || process.env.STAFF_EMAIL;
  const password = args.password || process.env.STAFF_PASSWORD;

  if (!['therapist', 'admin'].includes(role)) {
    console.error(`Role inválido: '${role}'. Debe ser 'therapist' o 'admin'.`);
    process.exit(1);
  }

  if (!name || !email || !password) {
    console.error('Faltan datos. Usa --name= --email= --password= (o STAFF_NAME/STAFF_EMAIL/STAFF_PASSWORD).');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Ya existe un usuario con email '${email}' (role: ${existing.role}). No se creó nada.`);
    process.exit(0);
  }

  // User.create dispara el pre('save') del modelo, que hashea password con bcrypt
  const user = await User.create({ name, email, password, role });
  console.log(`✓ ${role} creado: ${user.email} (${user._id})`);

  process.exit(0);
}

run().catch(err => {
  console.error('Error en seed de staff:', err);
  process.exit(1);
});
