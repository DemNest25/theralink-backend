const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { createPatient, getPatients, getPatientById } = require('../controllers/patient.controller');

router.use(protect, restrictTo('therapist'));

router.post('/', createPatient);
router.get('/', getPatients);
router.get('/:id', getPatientById);

module.exports = router;
