// src/app.js
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexión MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✓ MongoDB conectado'))
  .catch(err => console.error('✗ Error MongoDB:', err));

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✓ Servidor en puerto ${PORT}`));
