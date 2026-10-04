const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deactivatePatient,
  reactivatePatient,
  resetPatientPassword
} = require('../controllers/patient.controller');

const therapist = restrictTo('therapist');
// Edición y baja: el terapeuta dueño del paciente o un admin (ver patientFilter)
const staff = restrictTo('therapist', 'admin');

router.use(protect);

router.post('/', therapist, createPatient);
router.get('/', therapist, getPatients);
router.get('/:id', therapist, getPatientById);
router.patch('/:id', staff, updatePatient);
router.patch('/:id/deactivate', staff, deactivatePatient);
router.patch('/:id/reactivate', staff, reactivatePatient);
router.post('/:id/reset-password', therapist, resetPatientPassword);

module.exports = router;
