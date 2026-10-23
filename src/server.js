// src/server.js
// Arranque del proceso: valida el entorno, conecta MongoDB, monta Socket.io y
// escucha. app.js solo arma Express, para que los tests lo importen sin abrir
// puertos ni conectarse a la base real.
const http = require('http');
const mongoose = require('mongoose');
const env = require('./config/env');

env.assertServerEnv();

const app = require('./app');

// Conexión MongoDB. Si el primer intento falla (red, Atlas aún sin autorizar la
// IP) se reintenta; después de conectar, Mongoose se reconecta solo.
const MONGO_RETRY_MS = 5000;
async function connectMongo() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log(`✓ MongoDB conectado: ${env.describeMongoUri()}`);
  } catch (err) {
    console.error(`✗ Error MongoDB (${env.describeMongoUri()}): ${err.message}. Reintento en ${MONGO_RETRY_MS / 1000} s`);
    setTimeout(connectMongo, MONGO_RETRY_MS).unref();
  }
}
connectMongo();

const server = http.createServer(app);
require('./realtime/io').init(server);

// 0.0.0.0: accesible desde el hotspot en local y desde el proxy de Render en la nube
server.listen(env.port, env.host, () => {
  console.log(`✓ Servidor en ${env.host}:${env.port} (${env.isProduction ? 'producción' : 'desarrollo'})`);
  console.log(`  CORS: ${env.corsOrigins.length ? env.corsOrigins.join(', ') : '(ningún origen de navegador)'}`);
});
