// src/routes/command.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // para acceder a :id de la ruta padre
const { protect } = require('../middleware/auth.middleware');
const { authenticateDevice } = require('../middleware/device.middleware');
const { sendCommand, getPendingCommands, markExecuted } = require('../controllers/command.controller');

// Rutas de DISPOSITIVO (Quest) — x-device-key, van sin protect global
router.get(   '/pending',             authenticateDevice, getPendingCommands);
router.patch( '/:commandId/executed', authenticateDevice, markExecuted);

// Ruta de TERAPEUTA (dashboard) — requiere JWT
router.post('/', protect, sendCommand);

module.exports = router;