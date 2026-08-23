const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  getActiveSessionForDevice
} = require('../controllers/session.controller');

const { authenticateDevice } = require('../middleware/device.middleware');
const commandRoutes = require('./command.routes');

router.get('/active', authenticateDevice, getActiveSessionForDevice);

// Va ANTES de router.use(protect): adentro tiene rutas de dispositivo (sin JWT)
router.use('/:id/command', commandRoutes);

router.use(protect); // resto de rutas de sesiones requieren JWT

router.post('/',     createSession);
router.get('/',      getSessions);
router.get('/:id',   getSessionById);
router.patch('/:id', updateSession);
router.delete('/:id',deleteSession);

module.exports = router;