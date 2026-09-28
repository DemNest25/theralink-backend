const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { createPatient, getPatients, getPatientById, resetPatientPassword } = require('../controllers/patient.controller');

router.use(protect, restrictTo('therapist'));

router.post('/', createPatient);
router.get('/', getPatients);
router.get('/:id', getPatientById);
router.post('/:id/reset-password', resetPatientPassword);

module.exports = router;
