// Control de acceso: cada rol ve solo lo suyo (datos clínicos)
const request = require('supertest');
const app = require('../../src/app');
const { escenarioClinico, crearTerapeuta } = require('../helpers');

describe('Control de acceso por rol y propiedad', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  test('un paciente no puede listar pacientes → 403', async () => {
    const { pac } = await escenarioClinico();
    const res = await request(app).get('/api/patients').set('Authorization', `Bearer ${pac.token}`);
    expect(res.status).toBe(403);
  });

  test('un terapeuta no ve el perfil de un paciente ajeno → 404', async () => {
    const { pac } = await escenarioClinico();
    const otro = await crearTerapeuta();
    const res = await request(app).get(`/api/patients/${pac.user._id}`).set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(404);
  });

  test('un terapeuta no ve biométricos de una sesión ajena → 403', async () => {
    const { sesion } = await escenarioClinico();
    const otro = await crearTerapeuta();
    const res = await request(app).get(`/api/biometrics/session/${sesion._id}`).set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(403);
  });

  test('un terapeuta no puede cambiar el umbral de un paciente ajeno → 404', async () => {
    const { pac } = await escenarioClinico();
    const otro = await crearTerapeuta();
    const res = await request(app).patch(`/api/users/${pac.user._id}/threshold`)
      .set('Authorization', `Bearer ${otro.token}`).send({ hr: 120, hrv: 30 });
    expect(res.status).toBe(404);
  });

  test('el listado de pacientes nunca incluye la contraseña', async () => {
    const { ter } = await escenarioClinico();
    const res = await request(app).get('/api/patients').set('Authorization', `Bearer ${ter.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty('password');
  });
});
