// src/routes/me.routes.js
// Portal del paciente: solo lectura de sus propios datos (req.user.id)
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getMe, getMySessions } = require('../controllers/me.controller');

router.use(protect, restrictTo('patient'));

router.get('/',         getMe);
router.get('/sessions', getMySessions);

module.exports = router;
