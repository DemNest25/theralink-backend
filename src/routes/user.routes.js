const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { updateThreshold, updateSafePlace } = require('../controllers/user.controller');

router.use(protect, restrictTo('therapist'));

router.patch('/:id/threshold',  updateThreshold);
router.patch('/:id/safeplace',  updateSafePlace);

module.exports = router;