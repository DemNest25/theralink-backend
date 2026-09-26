# Contrato del visor (UE5 ↔ backend)

Este documento define cómo el visor (Meta Quest, UE5 + VaRestX) recibe órdenes del
terapeuta y confirma su ejecución. El visor arranca en un nivel **Lobby** sin
conocer ningún `sessionId`: el backend le entrega la sesión que le corresponde.

## 1. Autenticación

Todas las peticiones llevan el header:

```
x-device-key: <apiKey del Quest>
```

La `apiKey` se genera al crear el dispositivo (`npm run seed:devices`) y se imprime
una sola vez en consola. Identifica al visor: no hay que enviar el `deviceId`. Solo
los dispositivos de tipo `quest` pueden usar estas rutas (`403` si no). Sin key →
`401`; key inválida o dispositivo inactivo → `403`.

Cada petición autenticada actualiza `lastSeen` del dispositivo (con un throttle de
2 s). Un visor se considera **online** si `lastSeen` es de hace menos de 10 s, y el
terapeuta no puede iniciar una sesión si el visor no está online: **el polling es
también el latido del visor**.

## 2. Polling

`GET /api/devices/me/commands`

* Responde **siempre `200`** con JSON (nunca `204`).
* Frecuencia recomendada: **cada 3 s en el Lobby** (sin sesión) y **cada 1 s con
  sesión activa** (`cargando`, `en_curso` o `pausada`).
* Devuelve la sesión activa del visor y sus comandos `pending` en orden de creación.

### 2.1 Sin sesión (Lobby)

```json
{ "session": null, "commands": [] }
```

### 2.2 Sesión `cargando` con `load_scenario`

```json
{
  "session": {
    "id": "6a1f0c2e9b7d4a0012ab34cd",
    "status": "cargando",
    "pendingAction": "start",
    "scenario": { "key": "nicto_hab", "name": "Habitación", "mapName": "/Game/Maps/Nictofobia_Habitacion" },
    "safePlaceName": "la playa de mi abuela"
  },
  "commands": [
    {
      "id": "6a1f0c2e9b7d4a0012ab34ce",
      "commandType": "load_scenario",
      "payload": { "scenarioKey": "nicto_hab", "scenarioName": "Habitación", "mapName": "/Game/Maps/Nictofobia_Habitacion" },
      "createdAt": "2026-09-24T15:02:11.123Z"
    }
  ]
}
```

### 2.3 Sesión `en_curso` con un comando de escenario

```json
{
  "session": {
    "id": "6a1f0c2e9b7d4a0012ab34cd",
    "status": "en_curso",
    "pendingAction": null,
    "scenario": { "key": "arac_sala1", "name": "Sala Bote Cerrado", "mapName": "/Game/Maps/Aracnofobia_Sala-CB" },
    "safePlaceName": ""
  },
  "commands": [
    {
      "id": "6a1f0c2e9b7d4a0012ab34d0",
      "commandType": "spider_count",
      "payload": { "count": 3 },
      "createdAt": "2026-09-24T15:10:40.000Z"
    }
  ]
}
```

> El `payload` de los comandos de escenario es libre (el backend no lo valida): su
> forma se acuerda entre la web y UE5 por cada `commandType`. El ejemplo es
> ilustrativo.

### 2.4 Sesión `pausada`

```json
{
  "session": {
    "id": "6a1f0c2e9b7d4a0012ab34cd",
    "status": "pausada",
    "pendingAction": null,
    "scenario": { "key": "nicto_hab", "name": "Habitación", "mapName": "/Game/Maps/Nictofobia_Habitacion" },
    "safePlaceName": "la playa de mi abuela"
  },
  "commands": []
}
```

`safePlaceName` es el lugar seguro del paciente (cadena vacía si no tiene); se
muestra en la pantalla de pausa.

## 3. Confirmar un comando

### 3.1 Ejecutado

`PATCH /api/devices/me/commands/:commandId/executed` (sin body)

```json
{
  "message": "Comando ejecutado",
  "command": { "_id": "6a1f0c2e9b7d4a0012ab34ce", "commandType": "load_scenario", "status": "executed", "executedAt": "2026-09-24T15:02:19.500Z" },
  "session": { "id": "6a1f0c2e9b7d4a0012ab34cd", "status": "en_curso", "pendingAction": null }
}
```

* **Idempotente**: si el comando ya estaba `executed` responde `200` sin volver a
  aplicar nada (`"message": "Comando ya ejecutado"`). Es seguro reintentar si se
  pierde la respuesta.
* `403` si el comando no es de una sesión de este visor; `404` si no existe; `409`
  si el comando está `cancelled` o `failed`, o si la transición ya no es válida.

Efecto en la sesión al confirmar:

| commandType | Efecto |
|---|---|
| `load_scenario` | `cargando → en_curso` (fija `startTime` la primera vez) |
| `session_pause` | `en_curso → pausada` (abre un intervalo de pausa) |
| `session_resume` | `pausada → en_curso` (cierra el intervalo de pausa) |
| `session_end` | `→ finalizada` (o `→ cancelada` si estaba en `cargando`) |
| comandos de escenario | sin cambio de estado |

### 3.2 Fallido

`PATCH /api/devices/me/commands/:commandId/failed`

```json
{ "reason": "No se pudo cargar el mapa /Game/Maps/Nictofobia_Habitacion" }
```

Respuesta `200` con la misma forma que 3.1 y `command.status: "failed"`.

* `load_scenario` fallido → la sesión pasa a `cancelada`.
* `session_pause`, `session_resume` o `session_end` fallidos → el estado no cambia;
  solo se libera `pendingAction` para que la web pueda reintentar.

## 4. Reglas para UE5

1. **Ejecutar los comandos en el orden recibido** (el arreglo ya viene ordenado por
   `createdAt`).
2. **Confirmar cada comando** con `executed` (o `failed` si no pudo ejecutarlo), uno
   por uno, después de ejecutarlo de verdad.
3. **Reintentar la confirmación si falla la red**: es idempotente, no hay riesgo de
   aplicar dos veces.
4. Un comando que UE5 ya ejecutó pero no logró confirmar reaparece en el siguiente
   polling: ejecutarlo de nuevo puede duplicar su efecto. Guardar en memoria los
   `id` ya ejecutados y solo reintentar su confirmación.
5. Si al hacer polling llega `"session": null` estando en un mapa de escenario, la
   sesión terminó o se canceló: volver al Lobby.
6. Al confirmar `session_end` volver al Lobby y retomar el polling de 3 s.

## 5. commandType → acción esperada en UE5

| commandType | Acción esperada en UE5 |
|---|---|
| `load_scenario` | Abrir el mapa `payload.mapName`; al terminar de cargar, confirmar `executed` |
| `session_pause` | Congelar/atenuar la escena y mostrar la pantalla de pausa con `safePlaceName` |
| `session_resume` | Salir de la pausa y reanudar el escenario |
| `session_end` | Volver al nivel Lobby |
| `elevator_wall_material` | Cambiar el material de paredes del ascensor (vidrio ↔ metal) |
| `dressing_room_light` | Cambiar la luz del vestidor (encendida / intermitente / apagada) |
| `spider_movement` | Activar/desactivar el movimiento de las arañas |
| `spider_count` | Ajustar la cantidad de arañas (1–4) |
| `mri_control` | Control del escenario de resonancia (MRI) |

## 6. Rutas antiguas (deprecated)

`GET /api/sessions/:id/command/pending` y
`PATCH /api/sessions/:id/command/:commandId/executed` siguen funcionando sin cambios
para el UE5 actual, pero **no aplican transiciones de estado**. UE5 debe migrar a las
rutas de este documento; después se eliminarán.

## 7. Payloads de los comandos de escenario

| commandType | payload | Valores válidos | Escenario |
|---|---|---|---|
| `elevator_wall_material` | `{ "wall": "...", "material": "..." }` | wall: `Pared_norte` / `Pared_sur` / `Pared_este` · material: `glass` / `metal` | Ascensor |
| `dressing_room_light` | `{ "state": "..." }` | `on` / `flicker` / `off` | Vestidor |
| `spider_movement` | `{ "action": "start" \| "stop" }` | `start` activa; cualquier otro valor detiene | Salas de arañas |
| `spider_count` | `{ "count": 1-4 }` | entero de 1 a 4 | Salas de arañas |
| `mri_control` | `{ "action": "start" \| "stop" }` | `start` inicia; cualquier otro valor cancela | Resonancia |

Si el comando llega a un escenario sin el actor correspondiente, UE responde
`failed` con el motivo (p. ej. "No hay BP_CamillaMRI en el nivel").

Ejemplos:

    { "commandType": "elevator_wall_material", "payload": { "wall": "Pared_norte", "material": "glass" } }
    { "commandType": "dressing_room_light",    "payload": { "state": "flicker" } }
    { "commandType": "spider_movement",        "payload": { "action": "start" } }
    { "commandType": "spider_count",           "payload": { "count": 3 } }
    { "commandType": "mri_control",            "payload": { "action": "start" } }