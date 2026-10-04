// src/config/env.js
// Único lugar que lee la configuración del entorno. El mismo código corre en
// local (laptop + hotspot) y en la nube (Render + Atlas): solo cambian las
// variables. Lo usan app.js y los scripts de seed.
require('dotenv').config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const LOCAL_MONGO_URI = 'mongodb://localhost:27017/vr-therapy';
// MONGO_URI es el nombre anterior de la variable: se sigue aceptando
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || LOCAL_MONGO_URI;

// Orígenes de navegador permitidos en local: Vite (5173/5174) en la laptop y
// por la IP del hotspot (para abrir la web desde el teléfono)
const LOCAL_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://192.168.137.1:5173',
  'http://192.168.137.1:5174'
];

const parseList = (value) => String(value || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

const configuredOrigins = parseList(process.env.CORS_ORIGINS);
const corsOrigins = configuredOrigins.length > 0 ? configuredOrigins : (isProduction ? [] : LOCAL_CORS_ORIGINS);
const allowAnyOrigin = corsOrigins.includes('*');

// Misma regla para Express (cors) y Socket.io. Las peticiones sin cabecera
// Origin (Quest, reloj, Postman, health check) siempre pasan: CORS solo
// restringe a los navegadores.
function corsOrigin(origin, callback) {
  callback(null, !origin || allowAnyOrigin || corsOrigins.includes(origin));
}

const DEV_JWT_SECRET = 'solo-desarrollo-no-usar-en-produccion';

const env = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  host: '0.0.0.0',
  mongoUri,
  jwtSecret: process.env.JWT_SECRET || (isProduction ? undefined : DEV_JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigins,
  corsOrigin
};

// Host y base de datos de una URI de Mongo, sin usuario ni contraseña (para logs)
function describeMongoUri(uri = mongoUri) {
  const match = String(uri).match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!match) return 'URI no reconocida';
  return `${match[2]}/${match[3] || '(base por defecto)'} (${match[1] === 'mongodb+srv' ? 'Atlas/SRV' : 'directo'})`;
}

// Solo el servidor (app.js) la llama: en producción no arranca con la
// configuración incompleta; en local avisa y sigue con valores de desarrollo.
function assertServerEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (isProduction && !process.env.MONGODB_URI && !process.env.MONGO_URI) missing.push('MONGODB_URI');

  if (isProduction && missing.length > 0) {
    console.error(`✗ Faltan variables de entorno obligatorias en producción: ${missing.join(', ')}. El servidor no arranca.`);
    process.exit(1);
  }
  if (missing.includes('JWT_SECRET')) {
    console.warn('⚠ JWT_SECRET no está definido: se usa un secreto de desarrollo. Defínelo en .env.');
  }
  if (isProduction && corsOrigins.length === 0) {
    console.warn('⚠ CORS_ORIGINS está vacío: ningún navegador podrá usar la API. Agrega la URL de la web.');
  }
}

module.exports = { ...env, describeMongoUri, assertServerEnv };
