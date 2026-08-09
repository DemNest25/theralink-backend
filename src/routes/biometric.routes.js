const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authenticateDevice } = require('../middleware/device.middleware');
const {
  createBiometric,
  getBiometricsBySession,
  getBiometricSummary,
  ingestReadings
} = require('../controllers/biometric.controller');

// Ingesta desde el Watch — autenticada por API key de dispositivo, no por JWT
router.post('/:sessionId', authenticateDevice, ingestReadings);

router.use(protect);

router.post('/', createBiometric);
router.get('/session/:sessionId',         getBiometricsBySession);
router.get('/session/:sessionId/summary', getBiometricSummary);

module.exports = router;