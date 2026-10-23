// Umbral de ansiedad del paciente: dispara la alerta clínica en la sesión
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { escenarioClinico } = require('../helpers');

describe('PATCH /api/users/:id/threshold', () => {
  test('rechaza una frecuencia cardíaca negativa', async () => {
    const { ter, pac } = await escenarioClinico();
    const res = await request(app).patch(`/api/users/${pac.user._id}/threshold`)
      .set('Authorization', `Bearer ${ter.token}`).send({ hr: -50, hrv: 40 });
    expect(res.status).toBe(400);
  });

  test('rechaza un valor no numérico', async () => {
    const { ter, pac } = await escenarioClinico();
    const res = await request(app).patch(`/api/users/${pac.user._id}/threshold`)
      .set('Authorization', `Bearer ${ter.token}`).send({ hr: 'abc', hrv: 40 });
    expect(res.status).toBe(400);
  });

  test('si solo se envía hrv, el umbral de hr no se pierde', async () => {
    const { ter, pac } = await escenarioClinico();
    const res = await request(app).patch(`/api/users/${pac.user._id}/threshold`)
      .set('Authorization', `Bearer ${ter.token}`).send({ hrv: 35 });
    expect(res.status).toBe(200);
    const actualizado = await User.findById(pac.user._id).lean();
    expect(actualizado.anxietyThreshold.hr).toBe(100);
    expect(actualizado.anxietyThreshold.hrv).toBe(35);
  });
});
