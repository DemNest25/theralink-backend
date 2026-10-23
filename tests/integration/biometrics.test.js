// Ingesta de biométricos desde el reloj (POST /api/biometrics/:sessionId, header x-device-key)
const request = require('supertest');
const app = require('../../src/app');
const Biometric = require('../../src/models/Biometric');
const { escenarioClinico, crearReloj, crearPaciente, crearTerapeuta, crearEntorno } = require('../helpers');

const lectura = (extra = {}) => ({ timestamp: new Date().toISOString(), heartRate: 92, ...extra });
const enviar = (sesionId, key, readings) => {
  const req = request(app).post(`/api/biometrics/${sesionId}`);
  if (key) req.set('x-device-key', key);
  return req.send({ readings });
};

describe('POST /api/biometrics/:sessionId', () => {
  test('sin API key → 401', async () => {
    const { sesion } = await escenarioClinico();
    const res = await enviar(sesion._id, null, [lectura()]);
    expect(res.status).toBe(401);
  });

  test('API key inválida → rechazada', async () => {
    const { sesion } = await escenarioClinico();
    const res = await enviar(sesion._id, 'llave-falsa', [lectura()]);
    expect([401, 403]).toContain(res.status);
  });

  test('reloj de otro paciente no puede escribir en esta sesión → 403', async () => {
    const { sesion } = await escenarioClinico();
    const ter = await crearTerapeuta();
    const otroPac = await crearPaciente(ter.user, await crearEntorno());
    const relojAjeno = await crearReloj(otroPac.user);
    const res = await enviar(sesion._id, relojAjeno.apiKey, [lectura()]);
    expect(res.status).toBe(403);
  });

  test('sesión que no está en curso → 409', async () => {
    const { sesion, reloj } = await escenarioClinico('programada');
    const res = await enviar(sesion._id, reloj.apiKey, [lectura()]);
    expect(res.status).toBe(409);
  });

  test('frecuencia cardíaca fuera de rango → lote rechazado', async () => {
    const { sesion, reloj } = await escenarioClinico();
    const res = await enviar(sesion._id, reloj.apiKey, [lectura({ heartRate: 10 })]);
    expect(res.status).toBe(400);
    expect(res.body.rejected).toBe(1);
  });

  test('lote mixto: guarda las válidas y reporta las inválidas', async () => {
    const { sesion, reloj } = await escenarioClinico();
    const res = await enviar(sesion._id, reloj.apiKey, [lectura(), lectura({ heartRate: 500 }), lectura({ heartRate: 88 })]);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ inserted: 2, rejected: 1 });
    expect(await Biometric.countDocuments({ session: sesion._id })).toBe(2);
  });

  test('una lectura con fecha futura no debe aceptarse', async () => {
    const { sesion, reloj } = await escenarioClinico();
    const futura = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const res = await enviar(sesion._id, reloj.apiKey, [lectura({ timestamp: futura })]);
    expect(res.status).toBe(400);
  });
});
