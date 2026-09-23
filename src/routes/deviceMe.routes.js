const express = require('express');
const router = express.Router();
const { authenticateDevice, requireDeviceType } = require('../middleware/device.middleware');
const { getCommands, markExecuted, markFailed } = require('../controllers/deviceMe.controller');

// Solo el visor (quest), con x-device-key — sin JWT
router.use(authenticateDevice, requireDeviceType('quest'));

router.get('/commands', getCommands);
router.patch('/commands/:commandId/executed', markExecuted);
router.patch('/commands/:commandId/failed', markFailed);

module.exports = router;
