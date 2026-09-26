// scripts/simulate-devices.js
// ⚠ SOLO PARA DESARROLLO. Simula el visor (Quest) y/o el reloj (Wear OS)
// contra la API para probar la web sin hardware. NO lo corras a la vez que el
// Quest o el reloj reales con la misma apiKey: ambos confirmarían/enviarían
// datos por la misma sesión.
//
// Uso:
//   npm run simulate                     (claves desde SIM_QUEST_KEY / SIM_WATCH_KEY del .env)
//   npm run simulate -- --quest-key=<apiKey> --watch-key=<apiKey>
//   npm run simulate -- --quest-key=<apiKey> --delay=800 --fail=spider_count,mri_control
// Opciones:
//   --api=<url>          Base de la API (default http://localhost:3000/api)
//   --quest-key=<key>    apiKey del visor (si no, SIM_QUEST_KEY del .env)
//   --watch-key=<key>    apiKey del reloj (si no, SIM_WATCH_KEY del .env)
//   --delay=<ms>         Espera antes de confirmar cada comando (default 1500)
//   --fail=<t1,t2>       commandType que el visor reporta como fallidos
// Teclas: "s" fuerza un pico de FC (125–140 durante 20 s), "q" o Ctrl+C sale.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const POLL_MS = 2000;
const SPIKE_MS = 20000;

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=')];
    })
);

const API = (args.api || 'http://localhost:3000/api').replace(/\/$/, '');
const QUEST_KEY = args['quest-key'] || process.env.SIM_QUEST_KEY;
const WATCH_KEY = args['watch-key'] || process.env.SIM_WATCH_KEY;
const DELAY = Number(args.delay ?? 1500);
const FAIL = new Set((args.fail || '').split(',').map(s => s.trim()).filter(Boolean));

const log = (who, msg) => console.log(`${new Date().toLocaleTimeString()} [${who}] ${msg}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

async function api(method, path, key, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'x-device-key': key, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Visor ─────────────────────────────────────────────
const inFlight = new Set(); // commandId en espera de confirmar

async function handleCommand(cmd) {
  inFlight.add(cmd.id);
  try {
    log('quest', `comando recibido ${cmd.commandType} ${JSON.stringify(cmd.payload)}`);
    await sleep(DELAY);

    if (FAIL.has(cmd.commandType)) {
      const r = await api('PATCH', `/devices/me/commands/${cmd.id}/failed`, QUEST_KEY,
        { reason: 'Simulado: falla forzada' });
      log('quest', `comando fallido ${cmd.commandType} → ${r.status}${r.status >= 400 ? ' ' + r.data?.message : ''}`);
    } else {
      const r = await api('PATCH', `/devices/me/commands/${cmd.id}/executed`, QUEST_KEY);
      log('quest', `comando confirmado ${cmd.commandType} → ${r.status}` +
        (r.data?.session ? ` (sesión ${r.data.session.status})` : ` ${r.data?.message ?? ''}`));
    }
  } catch (err) {
    log('quest', `error confirmando ${cmd.commandType}: ${err.message}`);
  } finally {
    inFlight.delete(cmd.id);
  }
}

async function questTick() {
  try {
    const { status, data } = await api('GET', '/devices/me/commands', QUEST_KEY);
    if (status !== 200) return log('quest', `GET /devices/me/commands → ${status} ${data?.error ?? data?.message ?? ''}`);

    for (const cmd of data.commands) {
      if (!inFlight.has(cmd.id)) handleCommand(cmd); // sin await: sigue el polling
    }
  } catch (err) {
    log('quest', `sin conexión: ${err.message}`);
  }
}

// ── Reloj ─────────────────────────────────────────────
let heartRate = 85;
let spikeUntil = 0;
let lastWatchState = null;

function nextHeartRate() {
  if (Date.now() < spikeUntil) return Math.round(rand(125, 140));
  heartRate = Math.min(105, Math.max(70, heartRate + rand(-3, 3))); // caminata aleatoria
  return Math.round(heartRate);
}

function reading(timestamp) {
  return {
    timestamp,
    heartRate: nextHeartRate(),
    hrv: round(rand(30, 60)),
    eda: round(rand(1, 4), 2),
    skinTemperature: round(rand(32, 35))
  };
}

async function watchTick() {
  try {
    const active = await api('GET', '/sessions/active', WATCH_KEY);
    const state = active.status === 200 ? `${active.data.sessionId}:${active.data.status}` : 'sin sesión';
    if (state !== lastWatchState) {
      log('watch', active.status === 200 ? `sesión ${active.data.sessionId} ${active.data.status}` : `sin sesión activa (${active.status})`);
      lastWatchState = state;
    }
    if (active.status !== 200 || active.data.status !== 'en_curso') return; // pausada: no manda

    const now = Date.now();
    const readings = [reading(new Date(now - 1000)), reading(new Date(now))];
    const r = await api('POST', `/biometrics/${active.data.sessionId}`, WATCH_KEY, { readings });
    const fc = readings.map(x => x.heartRate).join('/');
    log('watch', `lote enviado FC ${fc}${Date.now() < spikeUntil ? ' (pico)' : ''} → ${r.status}` +
      (r.status === 201 ? ` inserted=${r.data.inserted} rejected=${r.data.rejected}` : ` ${r.data?.message ?? r.data?.error ?? ''}`));
  } catch (err) {
    log('watch', `sin conexión: ${err.message}`);
  }
}

// ── Arranque ──────────────────────────────────────────
function loop(fn) {
  const run = async () => { await fn(); setTimeout(run, POLL_MS); };
  run();
}

if (!QUEST_KEY && !WATCH_KEY) {
  console.error('Falta SIM_QUEST_KEY y/o SIM_WATCH_KEY en el .env (o --quest-key / --watch-key).');
  process.exit(1);
}

console.log(`Simulador contra ${API}  (solo desarrollo)`);
if (QUEST_KEY) {
  console.log(`  visor: delay ${DELAY} ms${FAIL.size ? `, falla: ${[...FAIL].join(', ')}` : ''}`);
  loop(questTick);
}
if (WATCH_KEY) {
  console.log('  reloj: "s" fuerza un pico de FC');
  loop(watchTick);
}
console.log('  "q" o Ctrl+C para salir\n');

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key === 'q') process.exit(0);
    if (key === 's' && WATCH_KEY) {
      spikeUntil = Date.now() + SPIKE_MS;
      log('watch', 'pico de FC forzado por 20 s');
    }
  });
}
