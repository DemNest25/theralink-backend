// Pruebas unitarias del manejador global de errores
const errorHandler = require('../../src/middleware/errorHandler');

function mockRes() {
  const res = { headersSent: false };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('errorHandler', () => {
  test('no expone el mensaje interno de un error 500', () => {
    const res = mockRes();
    const interno = new Error('connection to cluster0-shard-00-01.abc.mongodb.net:27017 timed out');
    errorHandler(interno, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('mongodb.net');
  });

  test('un ValidationError de password no repite el valor recibido', () => {
    const res = mockRes();
    const err = { name: 'ValidationError', errors: { password: { path: 'password', message: 'Path `password` (`abc`) is shorter than 8' } } };
    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('abc');
  });

  test('un CastError responde 400', () => {
    const res = mockRes();
    errorHandler({ name: 'CastError', path: '_id', value: 'xyz' }, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
