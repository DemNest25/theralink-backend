// src/controllers/command.controller.js
const SessionCommand = require('../models/SessionCommand');
const { loadOwnedSession } = require('../utils/ownership');
const { emitCommandUpdate } = require('../realtime/io');

const LIFECYCLE_COMMANDS = ['load_scenario', 'session_pause', 'session_resume', 'session_end'];

// POST /api/sessions/:id/command
// Terapeuta envía un comando de escenario desde el dashboard (los de ciclo de
// vida van por /start, /pause, /resume y /end)
const sendCommand = async (req, res, next) => {
  try {
    const { commandType, payload } = req.body;

    const session = await loadOwnedSession(req.params.id, req.user.id);

    if (LIFECYCLE_COMMANDS.includes(commandType)) {
      return res.status(400).json({ message: 'Usa los endpoints de control de sesión' });
    }

    if (session.status !== 'en_curso') {
      return res.status(409).json({ message: 'La sesión no está en curso' });
    }

    const command = await SessionCommand.create({
      session:     session._id,
      issuedBy:    req.user.id, // viene de protect (JWT)
      commandType,
      payload:     payload || {}
    });

    emitCommandUpdate(command); // otras pestañas del terapeuta lo ven pendiente
    res.status(201).json({ message: 'Comando enviado', command });
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:id/command
// Historial de comandos de una sesión propia, en orden de creación
const getCommandHistory = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.id, req.user.id);

    const commands = await SessionCommand.find({ session: session._id })
      .sort({ createdAt: 1 })
      .select('commandType payload status failureReason createdAt executedAt');

    res.json(commands);
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:id/command/pending
// UE5 consulta cada 3 segundos si hay comandos nuevos
const getPendingCommands = async (req, res, next) => {
  try {
    const commands = await SessionCommand.find({
      session: req.params.id,
      status:  'pending'
    }).sort({ createdAt: 1 }); // orden de llegada

    res.json(commands);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/sessions/:id/command/:commandId/executed
// UE5 confirma que ejecutó el comando
const markExecuted = async (req, res, next) => {
  try {
    const command = await SessionCommand.findByIdAndUpdate(
      req.params.commandId,
      { status: 'executed', executedAt: new Date() },
      { returnDocument: 'after' }
    );

    if (!command) {
      return res.status(404).json({ message: 'Comando no encontrado' });
    }

    res.json({ message: 'Comando marcado como ejecutado', command });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendCommand, getCommandHistory, getPendingCommands, markExecuted };