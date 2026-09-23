// src/realtime/io.js
// Tiempo real (Socket.io). Si io no está inicializado (scripts, tests) todos los
// emits son no-ops, y un fallo al emitir nunca rompe la petición HTTP.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Scenario = require('../models/Scenario');
const Device = require('../models/Device');
const { loadOwnedSession } = require('../utils/ownership');

const THERAPISTS_ROOM = 'therapists';
const DEVICE_CHECK_MS = 5000;

let io = null;
const lastOnline = new Map(); // deviceId -> boolean

const sessionRoom = (sessionId) => `session:${sessionId}`;

function init(server) {
  io = new Server(server, { cors: { origin: '*' } }); // igual que cors() de Express

  // Handshake: JWT en auth.token (navegador) o en el header Authorization
  // "Bearer <token>" (Postman); misma validación y solo therapist
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const token = socket.handshake.auth?.token || headerToken;
      if (!token) return next(new Error('Token requerido'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'therapist') return next(new Error('Solo terapeutas'));

      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token inválido o expirado'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(THERAPISTS_ROOM);

    socket.on('session:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        await loadOwnedSession(payload?.sessionId, socket.user.id);
        socket.join(sessionRoom(payload.sessionId));
        reply({ ok: true });
      } catch (err) {
        reply({ ok: false, message: err.status ? err.message : 'sessionId inválido' });
      }
    });

    socket.on('session:leave', (payload) => {
      if (payload?.sessionId) socket.leave(sessionRoom(payload.sessionId));
    });
  });

  // device:status — chequeo cada 5 s, emite solo cuando cambia online
  const timer = setInterval(checkDevices, DEVICE_CHECK_MS);
  timer.unref();

  return io;
}

async function checkDevices() {
  try {
    if (!io || !io.sockets.adapter.rooms.get(THERAPISTS_ROOM)?.size) return;

    const devices = await Device.find({ active: true }).select('deviceId type lastSeen');
    for (const d of devices) {
      const prev = lastOnline.get(d.deviceId);
      if (prev !== undefined && prev !== d.online) {
        io.to(THERAPISTS_ROOM).emit('device:status', { deviceId: d.deviceId, type: d.type, online: d.online });
      }
      lastOnline.set(d.deviceId, d.online);
    }
  } catch (err) {
    console.error('Error en chequeo de dispositivos:', err.message);
  }
}

function getIO() {
  return io;
}

// session:status → room de la sesión
async function emitSessionStatus(session) {
  if (!io) return;
  try {
    const scenarioId = session.scenario?._id ?? session.scenario;
    const scenario = scenarioId
      ? await Scenario.findById(scenarioId).select('key name order').lean()
      : null;

    io.to(sessionRoom(session._id)).emit('session:status', {
      sessionId: session._id,
      status: session.status,
      pendingAction: session.pendingAction,
      scenario,
      startTime: session.startTime,
      endTime: session.endTime,
      pauses: session.pauses
    });
  } catch (err) {
    console.error('Error emitiendo session:status:', err.message);
  }
}

// biometric:new → room de la sesión, una vez por lote
function emitBiometricBatch(sessionId, docs) {
  if (!io || docs.length === 0) return;
  try {
    io.to(sessionRoom(sessionId)).emit('biometric:new', {
      sessionId,
      readings: docs.map(d => ({
        timestamp: d.timestamp,
        heartRate: d.heartRate,
        hrv: d.hrv,
        eda: d.eda,
        skinTemperature: d.skinTemperature
      }))
    });
  } catch (err) {
    console.error('Error emitiendo biometric:new:', err.message);
  }
}

module.exports = { init, getIO, emitSessionStatus, emitBiometricBatch };
