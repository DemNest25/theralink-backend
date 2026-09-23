// src/utils/ownership.js
const Session = require('../models/Session');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Carga una sesión y verifica que pertenezca al terapeuta. Lanza HttpError
// (404 inexistente, 403 de otro terapeuta); errorHandler la responde.
async function loadOwnedSession(sessionId, therapistId) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new HttpError(404, 'Sesión no encontrada');
  }
  if (session.therapist.toString() !== String(therapistId)) {
    throw new HttpError(403, 'Esta sesión pertenece a otro terapeuta');
  }
  return session;
}

module.exports = { loadOwnedSession, HttpError };
