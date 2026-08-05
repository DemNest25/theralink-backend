// src/routes/command.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // para acceder a :id de la ruta padre
const { protect } = require('../middleware/auth.middleware');
const { sendCommand, getPendingCommands, markExecuted } = require('../controllers/command.controller');

router.use(protect);

router.post(  '/',                        sendCommand);
router.get(   '/pending',                 getPendingCommands);
router.patch( '/:commandId/executed',     markExecuted);

module.exports = router;