const User = require('../models/User');

// PATCH /api/users/:id/threshold
const updateThreshold = async (req, res, next) => {
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
    next(err);
  }
};

// PATCH /api/users/:id/safeplace
const updateSafePlace = async (req, res, next) => {
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
    next(err);
  }
};

module.exports = { updateThreshold, updateSafePlace };