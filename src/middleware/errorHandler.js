// src/middleware/errorHandler.js
// Manejador de errores global. Los controllers deben llamar next(err) en su
// catch en vez de responder 500 directamente, para que los errores conocidos
// de Mongoose se mapeen a un status correcto en un solo lugar.
const isSensitive = (path) => /password/i.test(path || '');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Los mensajes de Mongoose incluyen el valor rechazado: nunca para un password
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e =>
      isSensitive(e.path) ? `Valor inválido para '${e.path}'` : e.message
    );
    return res.status(400).json({ message: 'Datos inválidos', errors });
  }

  if (err.name === 'CastError') {
    const value = isSensitive(err.path) ? '' : `: '${err.value}'`;
    return res.status(400).json({ message: `Valor inválido para '${err.path}'${value}` });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Error del servidor' : err.message,
    error: err.message
  });
};

module.exports = errorHandler;
