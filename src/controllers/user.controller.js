const User = require('../models/User');

// PATCH /api/users/:id/threshold
const updateThreshold = async (req, res) => {
  try {
    const { hr, hrv } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'anxietyThreshold.hr': hr, 'anxietyThreshold.hrv': hrv },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Umbral actualizado', anxietyThreshold: user.anxietyThreshold });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// PATCH /api/users/:id/safeplace
const updateSafePlace = async (req, res) => {
  try {
    const { name, description } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'safePlace.name': name, 'safePlace.description': description },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Lugar seguro actualizado', safePlace: user.safePlace });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

module.exports = { updateThreshold, updateSafePlace };