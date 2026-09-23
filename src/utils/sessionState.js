// src/utils/sessionState.js
// Transiciones válidas del ciclo de vida de una Session.
// programada → cargando → en_curso ⇄ pausada → finalizada
// programada | cargando → cancelada
const TRANSITIONS = {
  programada: ['cargando', 'cancelada'],
  cargando:   ['en_curso', 'cancelada'],
  en_curso:   ['pausada', 'finalizada'],
  pausada:    ['en_curso', 'finalizada'],
  finalizada: [],
  cancelada:  []
};

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Transición de sesión inválida: '${from}' → '${to}'`);
    this.name = 'InvalidTransitionError';
    this.status = 409;
  }
}

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

module.exports = { TRANSITIONS, canTransition, assertTransition, InvalidTransitionError };
