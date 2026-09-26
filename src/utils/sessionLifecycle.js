// src/utils/sessionLifecycle.js
const Session = require('../models/Session');
const SessionCommand = require('../models/SessionCommand');
const { emitCommandUpdate } = require('../realtime/io');

const ACTIVE_STATUSES = ['cargando', 'en_curso', 'pausada'];

// Cancela los comandos pendientes de una sesión (opcionalmente salvo uno) y
// emite command:update por cada uno que efectivamente se canceló.
async function cancelPendingCommands(sessionId, exceptCommandId = null) {
  const filter = { session: sessionId, status: 'pending' };
  if (exceptCommandId) filter._id = { $ne: exceptCommandId };

  const ids = (await SessionCommand.find(filter).select('_id')).map(c => c._id);
  if (ids.length === 0) return;

  // status: 'pending' otra vez: si el visor reclamó uno entre medias, no se toca
  await SessionCommand.updateMany({ _id: { $in: ids }, status: 'pending' }, { $set: { status: 'cancelled' } });

  const cancelled = await SessionCommand.find({ _id: { $in: ids }, status: 'cancelled' });
  cancelled.forEach(emitCommandUpdate);
}

// Cierre común (F4): finalizada o cancelada. Fija endTime, cierra la pausa
// abierta, calcula durationMinutes, limpia pendingAction y cancela pendientes.
// `exceptCommandId` evita cancelar el comando que dispara el cierre.
async function closeSession(session, finalStatus, exceptCommandId = null) {
  const now = new Date();

  const openPause = session.pauses.find(p => !p.end);
  if (openPause) openPause.end = now;

  session.status = finalStatus;
  session.endTime = now;
  session.durationMinutes = session.calculateDurationMinutes(now);
  session.pendingAction = null;
  await session.save();

  await cancelPendingCommands(session._id, exceptCommandId);
  return session;
}

// ¿El paciente tiene otra sesión cargando/en_curso/pausada?
async function patientHasActiveSession(patientId, excludeSessionId = null) {
  const filter = { patient: patientId, status: { $in: ACTIVE_STATUSES } };
  if (excludeSessionId) filter._id = { $ne: excludeSessionId };
  return !!(await Session.exists(filter));
}

module.exports = { ACTIVE_STATUSES, cancelPendingCommands, closeSession, patientHasActiveSession };
