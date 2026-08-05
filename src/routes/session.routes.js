const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession
} = require('../controllers/session.controller');

router.use(protect); // todas las rutas de sesiones requieren JWT

router.post('/',     createSession);
router.get('/',      getSessions);
router.get('/:id',   getSessionById);
router.patch('/:id', updateSession);
router.delete('/:id',deleteSession);

module.exports = router;