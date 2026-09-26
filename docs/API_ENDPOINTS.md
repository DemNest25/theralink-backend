# API — endpoints

Base: `/api`. Roles: **T** = therapist, **A** = admin, **U** = cualquier usuario
autenticado (JWT `Authorization: Bearer <token>`). **Device** = header
`x-device-key`. Los errores de validación de Mongoose (`ValidationError`,
`CastError`) responden `400`.

## Autenticación

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| POST | /auth/login | — | — | Inicia sesión; devuelve JWT y usuario. Cuentas inactivas → 401 |
| POST | /auth/register | — | — | Deshabilitado (410). Staff por seed; pacientes por `POST /patients` |

## Pacientes

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| POST | /patients | JWT | T | Crea un paciente asignado al terapeuta (requiere `phobia`, un Environment activo) |
| GET | /patients | JWT | T | Lista los pacientes del terapeuta autenticado |
| GET | /patients/:id | JWT | T | Perfil de un paciente propio (fobia, lugar seguro, umbrales) |
| PATCH | /users/:id/threshold | JWT | T | Umbrales de ansiedad de un paciente propio |
| PATCH | /users/:id/safeplace | JWT | T | Lugar seguro de un paciente propio |

## Catálogo

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | /environments | JWT | U | Lista los Environments (fobias) activos |
| POST | /environments | JWT | A | Crea un Environment |
| PATCH | /environments/:id | JWT | A | Edita un Environment |
| GET | /scenarios?environment=`<id>` | JWT | T | Escenarios activos ordenados por `order` (sin query: todos) |
| GET | /devices | JWT | T | Dispositivos con `online` y `lastSeen` (nunca `apiKey`) |

## Sesiones

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| POST | /sessions | JWT | T | Crea una sesión `programada` (terapeuta del JWT, environment = fobia del paciente) |
| GET | /sessions | JWT | T | Sesiones del terapeuta (filtro opcional `?patient=`) |
| GET | /sessions/:id | JWT | T | Detalle con paciente, escenario y visor (solo propias) |
| PATCH | /sessions/:id | JWT | T | Notas/ansiedad y cierre manual (`status`: `cancelada` \| `finalizada`) |
| DELETE | /sessions/:id | JWT | T | Elimina solo sesiones `programada` o `cancelada` |
| POST | /sessions/:id/start | JWT | T | Body `{ scenarioId, deviceId, watchDeviceId? }`; pasa a `cargando` y envía `load_scenario` |
| POST | /sessions/:id/pause | JWT | T | Solicita pausa (`session_pause`); requiere `en_curso` |
| POST | /sessions/:id/resume | JWT | T | Solicita reanudar (`session_resume`); requiere `pausada` |
| POST | /sessions/:id/end | JWT | T | Solicita terminar (`session_end`); cancela comandos pendientes |
| POST | /sessions/:id/command | JWT | T | Envía un comando de escenario (sesión `en_curso`; no admite comandos de ciclo de vida) |
| GET | /sessions/:id/command | JWT | T | Historial de comandos de una sesión propia, por `createdAt` ascendente: `[{ _id, commandType, payload, status, failureReason, createdAt, executedAt }]` |

Los endpoints `start/pause/resume/end` solo piden la acción (`pendingAction`); el
estado final cambia cuando el visor confirma el comando.

## Biométricos

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| POST | /biometrics/:sessionId | Device | watch | Ingesta por lote `{ readings: [...] }` → `201 { inserted, rejected }` |
| GET | /biometrics/session/:sessionId | JWT | T | Lecturas de una sesión propia, en orden cronológico |
| GET | /biometrics/session/:sessionId/summary | JWT | T | Resumen estadístico de una sesión propia |

## Reloj (Wear OS)

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | /sessions/active | Device | watch | Sesión `en_curso`/`pausada` del paciente vinculado: `{ sessionId, environment, environmentName, status, startTime }`; sin sesión → 404 |

## Visor (Quest)

Contrato completo en [CONTRATO_VISOR.md](CONTRATO_VISOR.md).

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | /devices/me/commands | Device | quest | Sesión activa del visor y comandos pendientes (siempre 200) |
| PATCH | /devices/me/commands/:commandId/executed | Device | quest | Confirma un comando y aplica la transición (idempotente) |
| PATCH | /devices/me/commands/:commandId/failed | Device | quest | Marca un comando como fallido (`{ reason }`) |
| GET | /sessions/:id/command/pending | Device | quest | **Deprecated.** Comandos pendientes de una sesión |
| PATCH | /sessions/:id/command/:commandId/executed | Device | quest | **Deprecated.** Confirmación sin transiciones |

## Tiempo real (Socket.io)

Conexión al mismo servidor HTTP con `auth: { token: <JWT> }` (solo `therapist`).

| Evento | Dirección | Payload |
|---|---|---|
| `session:join` `{ sessionId }` | cliente → servidor | ack `{ ok: true }` o `{ ok: false, message }` (verifica propiedad) |
| `session:leave` `{ sessionId }` | cliente → servidor | — |
| `session:status` | servidor → room `session:<id>` | `{ sessionId, status, pendingAction, scenario, startTime, endTime, pauses }` |
| `biometric:new` | servidor → room `session:<id>` | `{ sessionId, readings: [{ timestamp, heartRate, hrv, eda, skinTemperature }] }` |
| `device:status` | servidor → todos los terapeutas | `{ deviceId, type, online }` al cambiar online/offline (chequeo cada 5 s) |
| `command:update` | servidor → room `session:<id>` | `{ sessionId, commandId, commandType, payload, status, failureReason, createdAt, executedAt }` al crear un comando de escenario (`pending`), al confirmarlo o fallar el visor (`executed` / `failed`) y al cancelarse (`cancelled`) |

## Máquina de estados de la sesión

`programada → cargando → en_curso ⇄ pausada → finalizada`; `programada | cargando →
cancelada`. Una transición inválida responde `409`. Un paciente (y un visor) no puede
tener más de una sesión en `cargando`, `en_curso` o `pausada` a la vez.

## Simulador (solo desarrollo)

`scripts/simulate-devices.js` imita al visor y/o al reloj para probar la web sin
hardware. No lo corras a la vez que el Quest o el reloj reales con la misma `apiKey`.

```bash
SIM_QUEST_KEY=<apiKey visor> SIM_WATCH_KEY=<apiKey reloj> npm run simulate
npm run simulate -- --quest-key=<apiKey> --delay=800 --fail=spider_count,mri_control
```

- **Visor** (`--quest-key` / `SIM_QUEST_KEY`): cada 2 s consulta `GET /devices/me/commands`
  (lo mantiene online), espera `--delay` ms (default 1500) y confirma cada comando con
  `executed`, o `failed` si su `commandType` está en `--fail`.
- **Reloj** (`--watch-key` / `SIM_WATCH_KEY`): cada 2 s consulta `GET /sessions/active` y, con la
  sesión `en_curso`, envía un lote de 2 lecturas (FC 70–105 en caminata aleatoria, HRV 30–60,
  EDA 1–4, temperatura 32–35). En `pausada` no envía. La tecla `s` fuerza un pico de FC
  (125–140) durante 20 s; `q` o Ctrl+C sale.
- `--api=<url>` cambia la base (default `http://localhost:3000/api`).
- Con `npm run simulate -- --quest-key=...` npm imprime los argumentos; si no quieres que la
  `apiKey` quede en la terminal, usa las variables de entorno.
