// tests/setup.js
// Base de datos aislada para cada corrida. Usa TEST_MONGO_URI si está definida
// (un MongoDB local o de CI); si no, levanta un MongoDB en memoria.
// Nunca apunta a Atlas: la base se vacía después de cada prueba.
const mongoose = require('mongoose');

let memoryServer = null;

beforeAll(async () => {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  const dbName = `theralink_test_${process.env.JEST_WORKER_ID || 0}_${Date.now()}`;
  await mongoose.connect(uri, { dbName });
});

beforeEach(() => {
  // El log por petición de app.js ensucia la salida de Jest
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  jest.restoreAllMocks();
  const collections = Object.values(mongoose.connection.collections);
  for (const c of collections) await c.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});
