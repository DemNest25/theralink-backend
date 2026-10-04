// scripts/seedCloud.js
// Siembra una base NUEVA para la nube (MongoDB Atlas) con lo mínimo para operar:
// environments, escenarios, dispositivos (Quest y reloj, con device keys propias
// de esa base) y un terapeuta demo. No copia pacientes, sesiones ni cuentas de QA.
//
// Idempotente: correrlo dos veces no duplica nada ni cambia las device keys ni la
// contraseña del terapeuta. Las credenciales quedan en .cloud-credentials.md
// (ignorado por git).
//
// Uso:
//   1. Crea .env.cloud (ignorado por git) con:   MONGODB_URI=mongodb+srv://...
//      (o exporta MONGODB_URI en la terminal)
//   2. npm run seed:cloud
//
// Opciones:
//   --email=<correo>          correo del terapeuta demo (default demo@theralink.app)
//   --name="<nombre>"         nombre del terapeuta demo (default "Terapeuta Demo")
//   --reset-demo-password     genera una contraseña nueva para el terapeuta demo
//   --allow-local             permite apuntar a localhost (solo para probar el script)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CLOUD_ENV_FILE = path.join(ROOT, '.env.cloud');
// CLOUD_CREDENTIALS_FILE permite escribir en otra ruta (pruebas del script)
const CREDENTIALS_FILE = process.env.CLOUD_CREDENTIALS_FILE || path.join(ROOT, '.cloud-credentials.md');

// .env.cloud tiene prioridad sobre .env: este script nunca debe caer en la base local por descuido
if (fs.existsSync(CLOUD_ENV_FILE)) {
  require('dotenv').config({ path: CLOUD_ENV_FILE, override: true, quiet: true });
}

const mongoose = require('mongoose');
const { describeMongoUri } = require('../src/config/env');
const User = require('../src/models/User');
const { seedEnvironments } = require('./seedEnvironments');
const { seedScenarios, assertScenarioData } = require('./seedScenarios');
const { seedDevices } = require('./seedDevices');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] ?? true;
  });
  return args;
}

const isLocalUri = (uri) => /\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/.test(uri);

// Contraseña legible (sin caracteres ambiguos) de 14 caracteres
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(14), b => alphabet[b % alphabet.length]).join('');
}

// Contraseña guardada en una corrida anterior (en la base solo queda el hash)
function previousPassword(email) {
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;
  const text = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
  const sameEmail = text.includes(`| Correo | \`${email}\` |`);
  const match = text.match(/\| Contraseña \| `([^`]+)` \|/);
  return sameEmail && match ? match[1] : null;
}

async function seedDemoTherapist({ name, email, resetPassword }) {
  const existing = await User.findOne({ email });
  if (existing && existing.role !== 'therapist') {
    throw new Error(`Abortado: '${email}' ya existe con role '${existing.role}'. Usa otro correo con --email=`);
  }

  if (!existing) {
    const password = generatePassword();
    await User.create({ name, email, password, role: 'therapist' });
    console.log(`+ creado     terapeuta demo ${email}`);
    return { name, email, password, note: 'Creado en esta corrida.' };
  }

  if (resetPassword) {
    const password = generatePassword();
    existing.password = password; // el pre('save') la hashea
    await existing.save({ validateModifiedOnly: true });
    console.log(`~ contraseña regenerada para ${email}`);
    return { name: existing.name, email, password, note: 'Contraseña regenerada en esta corrida.' };
  }

  console.log(`= existente  terapeuta demo ${email}`);
  const password = previousPassword(email);
  return {
    name: existing.name,
    email,
    password,
    note: password
      ? 'Ya existía; se conserva la contraseña.'
      : 'Ya existía y la contraseña no está guardada aquí. Corre `npm run seed:cloud -- --reset-demo-password` para generar una nueva.'
  };
}

function writeCredentials({ target, therapist, devices }) {
  const quest = devices.find(d => d.type === 'quest');
  const watch = devices.find(d => d.type === 'watch');
  const lines = [
    '# Credenciales de la nube (TheraLink)',
    '',
    '> Generado por `npm run seed:cloud`. NO subir a git (está en .gitignore).',
    '',
    `- Base de datos: \`${target}\``,
    `- Última corrida: ${new Date().toISOString()}`,
    '',
    '## Terapeuta demo',
    '',
    '| Dato | Valor |',
    '|---|---|',
    `| Nombre | ${therapist.name} |`,
    `| Correo | \`${therapist.email}\` |`,
    `| Contraseña | ${therapist.password ? `\`${therapist.password}\`` : '(no disponible)'} |`,
    '',
    therapist.note,
    '',
    '## Device keys (cabecera `x-device-key`)',
    '',
    '| Dispositivo | deviceId | Device key | Dónde se configura |',
    '|---|---|---|---|',
    `| Meta Quest | \`${quest?.deviceId}\` | \`${quest?.apiKey}\` | UE5: ver docs/CONTRATO_VISOR.md, "Cambiar a la nube" |`,
    `| Galaxy Watch | \`${watch?.deviceId}\` | \`${watch?.apiKey}\` | theralink-watch/theralink.properties → \`cloud.deviceKey\` |`,
    ''
  ];
  fs.writeFileSync(CREDENTIALS_FILE, lines.join('\n'));
}

async function run() {
  const args = parseArgs();
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Abortado: falta MONGODB_URI. Ponla en .env.cloud (MONGODB_URI=mongodb+srv://...) o expórtala en la terminal.');
  }
  if (isLocalUri(uri) && !args['allow-local']) {
    throw new Error('Abortado: MONGODB_URI apunta a localhost. seed:cloud es para Atlas; para la base local usa los seeds normales (o agrega --allow-local para probar).');
  }
  assertScenarioData();

  const target = describeMongoUri(uri);
  console.log(`Sembrando en: ${target}\n`);
  await mongoose.connect(uri);

  console.log('— Environments');
  await seedEnvironments();
  console.log('— Escenarios');
  await seedScenarios();
  console.log('— Dispositivos');
  const devices = await seedDevices();
  console.log('— Terapeuta demo');
  const therapist = await seedDemoTherapist({
    name: typeof args.name === 'string' ? args.name : 'Terapeuta Demo',
    email: String(typeof args.email === 'string' ? args.email : 'demo@theralink.app').trim().toLowerCase(),
    resetPassword: Boolean(args['reset-demo-password'])
  });

  writeCredentials({ target, therapist, devices });
  console.log(`\n✓ Listo. Credenciales y device keys en ${path.basename(CREDENTIALS_FILE)} (no se imprimen aquí).`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err.message?.startsWith('Abortado') ? err.message : err);
    process.exit(1);
  });
