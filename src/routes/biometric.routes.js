const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { authenticateDevice } = require('../middleware/device.middleware');
const {
  getBiometricsBySession,
  getBiometricSummary,
  ingestReadings
} = require('../controllers/biometric.controller');

// Ingesta desde el Watch — autenticada por API key de dispositivo, no por JWT
router.post('/:sessionId', authenticateDevice, ingestReadings);

router.use(protect, restrictTo('therapist'));

router.get('/session/:sessionId',         getBiometricsBySession);
router.get('/session/:sessionId/summary', getBiometricSummary);

module.exports = router;
