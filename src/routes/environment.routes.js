const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createEnvironment,
  getEnvironments,
  updateEnvironment
} = require('../controllers/environment.controller');

router.use(protect);

router.post('/',     createEnvironment);
router.get('/',      getEnvironments);
router.patch('/:id', updateEnvironment);

module.exports = router;