// tests/env.js — corre ANTES de cargar cualquier módulo (config/env.js lee el
// entorno al importarse)
process.env.JWT_SECRET = 'secreto-solo-para-tests';
process.env.NODE_ENV = 'test';
