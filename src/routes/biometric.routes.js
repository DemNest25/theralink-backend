const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createBiometric,
  getBiometricsBySession,
  getBiometricSummary
} = require('../controllers/biometric.controller');

router.use(protect);

router.post('/', createBiometric);
router.get('/session/:sessionId',         getBiometricsBySession);
router.get('/session/:sessionId/summary', getBiometricSummary);

module.exports = router;