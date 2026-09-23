const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  getActiveSessionForDevice
} = require('../controllers/session.controller');

const {
  startSession,
  pauseSession,
  resumeSession,
  endSession
} = require('../controllers/sessionControl.controller');

const { authenticateDevice } = require('../middleware/device.middleware');
const commandRoutes = require('./command.routes');

router.get('/active', authenticateDevice, getActiveSessionForDevice);

// Va ANTES de router.use(protect): adentro tiene rutas de dispositivo (sin JWT)
router.use('/:id/command', commandRoutes);

router.use(protect, restrictTo('therapist')); // resto de rutas de sesiones

router.post('/',     createSession);
router.get('/',      getSessions);
router.get('/:id',   getSessionById);
router.patch('/:id', updateSession);
router.delete('/:id',deleteSession);

router.post('/:id/start',  startSession);
router.post('/:id/pause',  pauseSession);
router.post('/:id/resume', resumeSession);
router.post('/:id/end',    endSession);

module.exports = router;
