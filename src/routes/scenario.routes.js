const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getScenarios } = require('../controllers/catalog.controller');

router.get('/', protect, restrictTo('therapist'), getScenarios);

module.exports = router;
