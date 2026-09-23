// src/middleware/errorHandler.js
// Manejador de errores global. Los controllers deben llamar next(err) en su
// catch en vez de responder 500 directamente, para que los errores conocidos
// de Mongoose se mapeen a un status correcto en un solo lugar.
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Datos inválidos', errors });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Valor inválido para '${err.path}': '${err.value}'` });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Error del servidor' : err.message,
    error: err.message
  });
};

module.exports = errorHandler;
