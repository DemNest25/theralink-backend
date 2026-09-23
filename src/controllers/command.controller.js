// src/controllers/command.controller.js
const SessionCommand = require('../models/SessionCommand');

// POST /api/sessions/:id/command
// Terapeuta envía un comando desde el dashboard
const sendCommand = async (req, res, next) => {
  try {
    const { commandType, payload } = req.body;

    const command = await SessionCommand.create({
      session:     req.params.id,
      issuedBy:    req.user.id, // viene de protect (JWT)
      commandType,
      payload:     payload || {}
    });

    res.status(201).json({ message: 'Comando enviado', command });
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

module.exports = { sendCommand, getPendingCommands, markExecuted };