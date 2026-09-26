// src/routes/command.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // para acceder a :id de la ruta padre
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { authenticateDevice } = require('../middleware/device.middleware');
const { sendCommand, getCommandHistory, getPendingCommands, markExecuted } = require('../controllers/command.controller');

// Rutas de DISPOSITIVO (Quest) — x-device-key, van sin protect global
router.get(   '/pending',             authenticateDevice, getPendingCommands);
router.patch( '/:commandId/executed', authenticateDevice, markExecuted);

// Rutas de TERAPEUTA (dashboard) — requieren JWT. GET '/' solo coincide con la
// raíz exacta, así que no intercepta GET /pending
router.post('/', protect, restrictTo('therapist'), sendCommand);
router.get(  '/', protect, restrictTo('therapist'), getCommandHistory);

module.exports = router;