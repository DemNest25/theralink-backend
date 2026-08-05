const Environment = require('../models/Environment');

// POST /api/environments
const createEnvironment = async (req, res) => {
  try {
    const { name, displayName, description, difficultyLevels } = req.body;

    const existing = await Environment.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe un ambiente con ese nombre' });
    }

    const environment = await Environment.create({
      name,
      displayName,
      description,
      difficultyLevels
    });

    res.status(201).json({ message: 'Ambiente creado', environment });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// GET /api/environments
const getEnvironments = async (req, res) => {
  try {
    const environments = await Environment.find({ isActive: true });
    res.json(environments);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// PATCH /api/environments/:id
const updateEnvironment = async (req, res) => {
  try {
    const allowed = ['displayName', 'description', 'difficultyLevels', 'isActive'];
    const updates = {};

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const environment = await Environment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!environment) {
      return res.status(404).json({ message: 'Ambiente no encontrado' });
    }

    res.json({ message: 'Ambiente actualizado', environment });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

module.exports = { createEnvironment, getEnvironments, updateEnvironment };