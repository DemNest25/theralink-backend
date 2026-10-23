// tests/helpers.js — fábricas de datos de prueba
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Environment = require('../src/models/Environment');
const Session = require('../src/models/Session');
const Device = require('../src/models/Device');

let seq = 0;
const uniq = () => `${Date.now()}_${++seq}`;

const tokenFor = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function crearEntorno() {
  const n = uniq();
  return Environment.create({ name: `nictofobia_${n}`, displayName: 'Nictofobia' });
}

async function crearTerapeuta(extra = {}) {
  const user = await User.create({
    name: 'Terapeuta Prueba', email: `ter_${uniq()}@test.gt`,
    password: 'Clave-Segura-123', role: 'therapist', ...extra
  });
  return { user, token: tokenFor(user) };
}

async function crearPaciente(terapeuta, environment, extra = {}) {
  const user = await User.create({
    name: 'Paciente Prueba', email: `pac_${uniq()}@test.gt`,
    password: 'Clave-Segura-123', role: 'patient',
    phobia: environment._id, assignedTherapist: terapeuta._id, ...extra
  });
  return { user, token: tokenFor(user) };
}

async function crearSesion(terapeuta, paciente, environment, status = 'en_curso') {
  return Session.create({
    patient: paciente._id, therapist: terapeuta._id, environment: environment._id,
    status, startTime: status === 'programada' ? null : new Date(Date.now() - 60_000)
  });
}

async function crearReloj(paciente) {
  return Device.create({
    deviceId: `watch_${uniq()}`, type: 'watch', apiKey: `key_${uniq()}`,
    patient: paciente ? paciente._id : null
  });
}

// Escenario completo: terapeuta + paciente + sesión + reloj vinculado
async function escenarioClinico(statusSesion = 'en_curso') {
  const env = await crearEntorno();
  const ter = await crearTerapeuta();
  const pac = await crearPaciente(ter.user, env);
  const sesion = await crearSesion(ter.user, pac.user, env, statusSesion);
  const reloj = await crearReloj(pac.user);
  return { env, ter, pac, sesion, reloj };
}

module.exports = {
  tokenFor, crearEntorno, crearTerapeuta, crearPaciente, crearSesion, crearReloj, escenarioClinico
};
