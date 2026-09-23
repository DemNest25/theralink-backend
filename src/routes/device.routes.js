const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getDevices } = require('../controllers/catalog.controller');

router.get('/', protect, restrictTo('therapist'), getDevices);

module.exports = router;
