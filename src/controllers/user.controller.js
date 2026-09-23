const User = require('../models/User');

// Solo el terapeuta asignado puede editar a su paciente; si no, 404
const ownPatientFilter = (req) => ({
  _id: req.params.id,
  role: 'patient',
  assignedTherapist: req.user.id
});

// PATCH /api/users/:id/threshold
const updateThreshold = async (req, res, next) => {
  try {
    const { hr, hrv } = req.body;

    const user = await User.findOneAndUpdate(
      ownPatientFilter(req),
      { 'anxietyThreshold.hr': hr, 'anxietyThreshold.hrv': hrv },
      { returnDocument: 'after', runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
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

    const user = await User.findOneAndUpdate(
      ownPatientFilter(req),
      { 'safePlace.name': name, 'safePlace.description': description },
      { returnDocument: 'after', runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    res.json({ message: 'Lugar seguro actualizado', safePlace: user.safePlace });
  } catch (err) {
    next(err);
  }
};

module.exports = { updateThreshold, updateSafePlace };
