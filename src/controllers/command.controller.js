// src/controllers/command.controller.js
const SessionCommand = require('../models/SessionCommand');

// POST /api/sessions/:id/command
// Terapeuta envía un comando desde el dashboard
const sendCommand = async (req, res) => {
  try {
    const { commandType, payload } = req.body;

    const command = await SessionCommand.create({
      session:     req.params.id,
      commandType,
      payload:     payload || {}
    });

    res.status(201).json({ message: 'Comando enviado', command });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// GET /api/sessions/:id/command/pending
// UE5 consulta cada 500ms–1s si hay comandos nuevos
const getPendingCommands = async (req, res) => {
  try {
    const commands = await SessionCommand.find({
      session: req.params.id,
      status:  'pending'
    }).sort({ createdAt: 1 }); // orden de llegada

    res.json(commands);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// PATCH /api/sessions/:id/command/:commandId/executed
// UE5 confirma que ejecutó el comando
const markExecuted = async (req, res) => {
  try {
    const command = await SessionCommand.findByIdAndUpdate(
      req.params.commandId,
      { status: 'executed', executedAt: new Date() },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({ message: 'Comando no encontrado' });
    }

    res.json({ message: 'Comando marcado como ejecutado', command });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

module.exports = { sendCommand, getPendingCommands, markExecuted };