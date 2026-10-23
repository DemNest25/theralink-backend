// Autenticación: login y validez del token
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { crearTerapeuta } = require('../helpers');

describe('POST /api/auth/login', () => {
  test('sin cuerpo responde 400, no 500', async () => {
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(400);
  });

  test('sin contraseña responde 400, no 500', async () => {
    const { user } = await crearTerapeuta();
    const res = await request(app).post('/api/auth/login').send({ email: user.email });
    expect(res.status).toBe(400);
  });

  test('contraseña incorrecta responde 401 genérico', async () => {
    const { user } = await crearTerapeuta();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'otra-clave-123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas');
  });

  test('login correcto: el token solo lleva id y rol', async () => {
    const { user } = await crearTerapeuta();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Clave-Segura-123' });
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'id', 'role']);
    expect(JSON.stringify(res.body)).not.toContain('$2'); // ningún hash bcrypt en la respuesta
  });
});

describe('Validez del token', () => {
  test('un terapeuta desactivado ya no puede usar su token', async () => {
    const { user, token } = await crearTerapeuta();
    await User.updateOne({ _id: user._id }, { isActive: false });

    const res = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('un token firmado con otro secreto se rechaza', async () => {
    const falso = jwt.sign({ id: '6ac5b495eaa246700bff6c7f', role: 'therapist' }, 'otro-secreto');
    const res = await request(app).get('/api/patients').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
  });
});
