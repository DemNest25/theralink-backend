const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  createEnvironment,
  getEnvironments,
  updateEnvironment
} = require('../controllers/environment.controller');

router.use(protect);

router.post('/',     restrictTo('admin'), createEnvironment);
router.get('/',      getEnvironments);
router.patch('/:id', restrictTo('admin'), updateEnvironment);

module.exports = router;