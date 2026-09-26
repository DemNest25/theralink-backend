// src/controllers/sessionControl.controller.js
// Control del ciclo de vida de la sesión desde la web. Estos endpoints piden la
// acción (pendingAction + comando); el estado final lo aplica el visor al
// confirmar el comando (ver deviceMe.controller.js).
const Session = require('../models/Session');
const SessionCommand = require('../models/SessionCommand');
const Scenario = require('../models/Scenario');
const Device = require('../models/Device');
const { loadOwnedSession } = require('../utils/ownership');
const { emitSessionStatus, emitCommandUpdate } = require('../realtime/io');
const {
  ACTIVE_STATUSES,
  cancelPendingCommands,
  patientHasActiveSession
} = require('../utils/sessionLifecycle');

const conflict = (res, message) => res.status(409).json({ message });

// Aplica `update` solo si la sesión sigue cumpliendo `guard` (evita que un doble
// clic o dos pestañas disparen dos acciones). null → la condición ya no se cumple.
const claimSession = (sessionId, guard, update) =>
  Session.findOneAndUpdate({ _id: sessionId, ...guard }, { $set: update }, { returnDocument: 'after' });

// Crea el comando de ciclo de vida y lo emite como pending (command:update)
async function createCommand(session, userId, commandType, payload = {}) {
  const command = await SessionCommand.create({ session: session._id, issuedBy: userId, commandType, payload });
  emitCommandUpdate(command);
  return command;
}

// POST /api/sessions/:id/start  { scenarioId, deviceId, watchDeviceId? }
const startSession = async (req, res, next) => {
  try {
    const { scenarioId, deviceId, watchDeviceId } = req.body;
    const session = await loadOwnedSession(req.params.id, req.user.id);

    if (session.status !== 'programada') {
      return conflict(res, `La sesión está '${session.status}', solo se puede iniciar una sesión programada`);
    }

    const scenario = scenarioId ? await Scenario.findById(scenarioId) : null;
    if (!scenario || !scenario.active) {
      return res.status(400).json({ message: 'Escenario inexistente o inactivo' });
    }
    if (scenario.environment.toString() !== session.environment.toString()) {
      return res.status(400).json({ message: 'El escenario no corresponde a la fobia de la sesión' });
    }

    const quest = deviceId ? await Device.findOne({ deviceId, type: 'quest', active: true }) : null;
    if (!quest) {
      return res.status(404).json({ message: 'Visor (quest) no encontrado' });
    }
    if (!quest.online) {
      return conflict(res, 'El visor no está conectado');
    }

    if (await Session.exists({ device: quest._id, status: { $in: ACTIVE_STATUSES } })) {
      return conflict(res, 'El visor ya tiene una sesión cargando, en curso o en pausa');
    }

    if (await patientHasActiveSession(session.patient, session._id)) {
      return conflict(res, 'El paciente ya tiene otra sesión cargando, en curso o en pausa');
    }

    let watch = null;
    if (watchDeviceId) {
      watch = await Device.findOne({ deviceId: watchDeviceId, type: 'watch', active: true });
      if (!watch) {
        return res.status(404).json({ message: 'Reloj (watch) no encontrado' });
      }
      const linkedElsewhere = watch.patient && watch.patient.toString() !== session.patient.toString();
      if (linkedElsewhere && await patientHasActiveSession(watch.patient)) {
        return conflict(res, 'El reloj está vinculado a otro paciente con una sesión activa');
      }
    }

    const updated = await claimSession(
      session._id,
      { status: 'programada' },
      { scenario: scenario._id, device: quest._id, status: 'cargando', pendingAction: 'start' }
    );
    if (!updated) {
      return conflict(res, 'La sesión cambió de estado, intenta de nuevo');
    }

    if (watch) {
      await Device.updateOne({ _id: watch._id }, { $set: { patient: session.patient } });
    }

    await createCommand(updated, req.user.id, 'load_scenario', {
      scenarioKey: scenario.key,
      scenarioName: scenario.name,
      mapName: scenario.mapName
    });

    emitSessionStatus(updated);
    res.json({ message: 'Sesión iniciándose, esperando al visor', session: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/sessions/:id/pause
const pauseSession = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    const updated = await claimSession(
      session._id,
      { status: 'en_curso', pendingAction: null },
      { pendingAction: 'pause' }
    );
    if (!updated) {
      return conflict(res, 'Solo se puede pausar una sesión en curso sin otra acción pendiente');
    }

    await createCommand(updated, req.user.id, 'session_pause');
    emitSessionStatus(updated);
    res.json({ message: 'Pausa solicitada, esperando al visor', session: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/sessions/:id/resume
const resumeSession = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    const updated = await claimSession(
      session._id,
      { status: 'pausada', pendingAction: null },
      { pendingAction: 'resume' }
    );
    if (!updated) {
      return conflict(res, 'Solo se puede reanudar una sesión pausada sin otra acción pendiente');
    }

    await createCommand(updated, req.user.id, 'session_resume');
    emitSessionStatus(updated);
    res.json({ message: 'Reanudación solicitada, esperando al visor', session: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/sessions/:id/end — permitido aunque haya otra acción pendiente
const endSession = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    const updated = await claimSession(
      session._id,
      { status: { $in: ACTIVE_STATUSES } },
      { pendingAction: 'end' }
    );
    if (!updated) {
      return conflict(res, 'Solo se puede terminar una sesión cargando, en curso o en pausa');
    }

    await cancelPendingCommands(updated._id);
    await createCommand(updated, req.user.id, 'session_end');
    emitSessionStatus(updated);
    res.json({ message: 'Fin de sesión solicitado, esperando al visor', session: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { startSession, pauseSession, resumeSession, endSession };
