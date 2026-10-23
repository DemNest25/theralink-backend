// Pruebas unitarias del ciclo de vida de la sesión (lógica pura, sin HTTP)
const { canTransition, assertTransition, InvalidTransitionError } = require('../../src/utils/sessionState');
const Session = require('../../src/models/Session');

describe('Máquina de estados de la sesión', () => {
  test.each([
    ['programada', 'cargando'],
    ['cargando', 'en_curso'],
    ['en_curso', 'pausada'],
    ['pausada', 'en_curso'],
    ['en_curso', 'finalizada'],
    ['programada', 'cancelada']
  ])('permite %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  test.each([
    ['finalizada', 'en_curso'],   // una sesión cerrada no se reabre
    ['cancelada', 'programada'],
    ['programada', 'en_curso'],   // no se salta la carga del visor
    ['en_curso', 'cancelada'],    // una sesión con datos clínicos se finaliza, no se cancela
    ['estado_inventado', 'en_curso']
  ])('bloquea %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
  });

  test('el error de transición lleva status 409', () => {
    try { assertTransition('finalizada', 'pausada'); } catch (e) { expect(e.status).toBe(409); }
  });
});

describe('Duración de la sesión descontando pausas', () => {
  const t = (min) => new Date(Date.UTC(2026, 9, 23, 15, min));

  test('30 min con una pausa de 10 min = 20 min efectivos', () => {
    const s = new Session({ startTime: t(0), pauses: [{ start: t(10), end: t(20) }] });
    expect(s.calculateDurationMinutes(t(30))).toBe(20);
  });

  test('una pausa abierta cuenta hasta el cierre', () => {
    const s = new Session({ startTime: t(0), pauses: [{ start: t(25), end: null }] });
    expect(s.calculateDurationMinutes(t(30))).toBe(25);
  });

  test('una sesión que nunca inició no tiene duración', () => {
    const s = new Session({ startTime: null });
    expect(s.calculateDurationMinutes(t(30))).toBeNull();
  });
});
