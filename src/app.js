// src/app.js
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const env = require('./config/env');

env.assertServerEnv();

const app = express();
// Render (y cualquier PaaS) va detrás de un proxy: IP y protocolo reales del cliente
app.set('trust proxy', 1);
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

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

// GET /health — sin auth y sin log por petición. Lo usan el health check de
// Render y el "despertador" de la web. 503 mientras no haya base de datos.
app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: 'ok',
    db: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime())
  });
});

app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - t0} ms)`);
  });
  next();
});

// Rutas
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/sessions',  require('./routes/session.routes'));
app.use('/api/patients',  require('./routes/patient.routes'));
app.use('/api/biometrics',require('./routes/biometric.routes'));
app.use('/api/environments', require('./routes/environment.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/scenarios', require('./routes/scenario.routes'));
app.use('/api/me', require('./routes/me.routes'));
// /me (visor, x-device-key) va ANTES de /api/devices, que exige JWT
app.use('/api/devices/me', require('./routes/deviceMe.routes'));
app.use('/api/devices', require('./routes/device.routes'));

app.use(require('./middleware/errorHandler'));

const server = http.createServer(app);
require('./realtime/io').init(server);

// 0.0.0.0: accesible desde el hotspot en local y desde el proxy de Render en la nube
server.listen(env.port, env.host, () => {
  console.log(`✓ Servidor en ${env.host}:${env.port} (${env.isProduction ? 'producción' : 'desarrollo'})`);
  console.log(`  CORS: ${env.corsOrigins.length ? env.corsOrigins.join(', ') : '(ningún origen de navegador)'}`);
});
