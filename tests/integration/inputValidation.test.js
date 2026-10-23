// Validación de tipos en entradas que llegan a consultas de la base
// (corrige los hallazgos de Sonar en environment.controller y sessionControl.controller)
const request = require('supertest');
const app = require('../../src/app');
const Environment = require('../../src/models/Environment');
const Scenario = require('../../src/models/Scenario');
const { escenarioClinico, crearTerapeuta, crearSesion } = require('../helpers');

describe('Validación de tipos de entrada', () => {
  test('crear entorno sin nombre → 400 con mensaje correcto', async () => {
    await Environment.create({ name: 'existente', displayName: 'Existente' });
    const admin = await crearTerapeuta({ role: 'admin' });
    const res = await request(app).post('/api/environments')
      .set('Authorization', `Bearer ${admin.token}`).send({ displayName: 'Sin nombre' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/requeridos/);
  });

  test('crear entorno con nombre que no es texto → 400', async () => {
    const admin = await crearTerapeuta({ role: 'admin' });
    const res = await request(app).post('/api/environments')
      .set('Authorization', `Bearer ${admin.token}`).send({ name: 123, displayName: 'X' });
    expect(res.status).toBe(400);
  });

  test('iniciar sesión con deviceId que no es texto → 400', async () => {
    const { ter, pac, env } = await escenarioClinico();
    const sesion = await crearSesion(ter.user, pac.user, env, 'programada');
    const escenario = await Scenario.create({ key: 'n1', name: 'Nivel 1', environment: env._id, mapName: 'Mapa1', order: 1 });
    const res = await request(app).post(`/api/sessions/${sesion._id}/start`)
      .set('Authorization', `Bearer ${ter.token}`).send({ scenarioId: String(escenario._id), deviceId: ['quest-01'] });
    expect(res.status).toBe(400);
  });
});
