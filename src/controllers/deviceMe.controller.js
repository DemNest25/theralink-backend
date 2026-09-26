// src/controllers/deviceMe.controller.js
// Endpoints del visor (Quest) — autenticados con x-device-key. Contrato en
// docs/CONTRATO_VISOR.md.
const Session = require('../models/Session');
const SessionCommand = require('../models/SessionCommand');
const { assertTransition, InvalidTransitionError } = require('../utils/sessionState');
const { ACTIVE_STATUSES, closeSession } = require('../utils/sessionLifecycle');
const { emitSessionStatus, emitCommandUpdate } = require('../realtime/io');

// commandType de ciclo de vida → pendingAction que lo originó
const ACTION_OF = {
  load_scenario: 'start',
  session_pause: 'pause',
  session_resume: 'resume',
  session_end: 'end'
};

const summary = (session) => ({
  id: session._id,
  status: session.status,
  pendingAction: session.pendingAction
});

// GET /api/devices/me/commands — siempre 200
const getCommands = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      device: req.device._id,
      status: { $in: ACTIVE_STATUSES }
    })
      .populate('scenario', 'key name mapName')
      .populate('patient', 'safePlace');

    if (!session) {
      return res.json({ session: null, commands: [] });
    }

    const commands = await SessionCommand.find({ session: session._id, status: 'pending' })
      .sort({ createdAt: 1 });

    res.json({
      session: {
        id: session._id,
        status: session.status,
        pendingAction: session.pendingAction,
        scenario: session.scenario
          ? { key: session.scenario.key, name: session.scenario.name, mapName: session.scenario.mapName }
          : null,
        safePlaceName: session.patient?.safePlace?.name || ''
      },
      commands: commands.map(c => ({
        id: c._id,
        commandType: c.commandType,
        payload: c.payload,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

// Carga comando + sesión y verifica que la sesión sea de este Quest (403 si no)
async function loadOwnCommand(req, res) {
  const command = await SessionCommand.findById(req.params.commandId);
  if (!command) {
    res.status(404).json({ message: 'Comando no encontrado' });
    return null;
  }

  const session = await Session.findById(command.session);
  if (!session || !session.device || session.device.toString() !== req.device._id.toString()) {
    res.status(403).json({ message: 'El comando no pertenece a este visor' });
    return null;
  }

  return { command, session };
}

// Estado al que lleva un comando de ciclo de vida (null: comandos de escenario)
function targetStatus(session, commandType) {
  switch (commandType) {
    case 'load_scenario':  return 'en_curso';
    case 'session_pause':  return 'pausada';
    case 'session_resume': return 'en_curso';
    case 'session_end':    return session.status === 'cargando' ? 'cancelada' : 'finalizada';
    default:               return null;
  }
}

// Aplica en la sesión el efecto de un comando ya validado con assertTransition
async function applyExecuted(session, command) {
  const now = new Date();
  const target = targetStatus(session, command.commandType);
  if (!target) return; // comandos de escenario: sin cambio de estado

  if (command.commandType === 'session_end') {
    await closeSession(session, target, command._id); // guarda y limpia pendingAction
    return;
  }

  session.status = target;
  if (command.commandType === 'load_scenario' && !session.startTime) {
    session.startTime = now;
  }
  if (command.commandType === 'session_pause') {
    session.pauses.push({ start: now });
  }
  if (command.commandType === 'session_resume') {
    const open = [...session.pauses].reverse().find(p => !p.end);
    if (open) open.end = now;
  }

  if (session.pendingAction === ACTION_OF[command.commandType]) {
    session.pendingAction = null;
  }
  await session.save();
}

// PATCH /api/devices/me/commands/:commandId/executed
const markExecuted = async (req, res, next) => {
  try {
    const loaded = await loadOwnCommand(req, res);
    if (!loaded) return;
    const { command, session } = loaded;

    // Idempotente: UE5 puede reintentar si perdió la respuesta
    if (command.status === 'executed') {
      return res.json({ message: 'Comando ya ejecutado', command, session: summary(session) });
    }
    if (command.status !== 'pending') {
      return res.status(409).json({ message: `El comando está '${command.status}'` });
    }

    try {
      // Valida la transición antes de marcar el comando (sin efectos si falla)
      const target = targetStatus(session, command.commandType);
      if (target) assertTransition(session.status, target);
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }

    // Reclamo atómico: dos reintentos simultáneos no aplican el efecto dos veces
    const claimed = await SessionCommand.findOneAndUpdate(
      { _id: command._id, status: 'pending' },
      { $set: { status: 'executed', executedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!claimed) {
      const current = await SessionCommand.findById(command._id);
      if (current.status === 'executed') {
        return res.json({ message: 'Comando ya ejecutado', command: current, session: summary(session) });
      }
      return res.status(409).json({ message: `El comando está '${current.status}'` });
    }
    emitCommandUpdate(claimed);

    await applyExecuted(session, claimed);
    if (targetStatus(session, claimed.commandType) !== null) emitSessionStatus(session);

    res.json({ message: 'Comando ejecutado', command: claimed, session: summary(session) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/devices/me/commands/:commandId/failed  { reason }
const markFailed = async (req, res, next) => {
  try {
    const loaded = await loadOwnCommand(req, res);
    if (!loaded) return;
    const { command, session } = loaded;

    if (command.status === 'failed') {
      return res.json({ message: 'Comando ya marcado como fallido', command, session: summary(session) });
    }
    if (command.status !== 'pending') {
      return res.status(409).json({ message: `El comando está '${command.status}'` });
    }

    // load_scenario fallido cancela la sesión: validar antes de tocar nada
    if (command.commandType === 'load_scenario') {
      try {
        assertTransition(session.status, 'cancelada');
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          return res.status(err.status).json({ message: err.message });
        }
        throw err;
      }
    }

    const claimed = await SessionCommand.findOneAndUpdate(
      { _id: command._id, status: 'pending' },
      { $set: { status: 'failed', failureReason: req.body.reason || null } },
      { returnDocument: 'after' }
    );
    if (!claimed) {
      const current = await SessionCommand.findById(command._id);
      return res.status(409).json({ message: `El comando está '${current.status}'` });
    }
    emitCommandUpdate(claimed);

    if (claimed.commandType === 'load_scenario') {
      await closeSession(session, 'cancelada', claimed._id);
    } else if (session.pendingAction === ACTION_OF[claimed.commandType]) {
      // pause / resume / end fallidos: el estado no cambia, se libera la web
      session.pendingAction = null;
      await session.save();
    }
    emitSessionStatus(session);

    res.json({ message: 'Comando marcado como fallido', command: claimed, session: summary(session) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCommands, markExecuted, markFailed };
