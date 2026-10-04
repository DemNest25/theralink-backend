# Despliegue en la nube (Render + MongoDB Atlas)

TheraLink corre **en local o en la nube con el mismo código**: solo cambian las
variables de entorno (backend y web) y la variante de build (reloj y visor).

| Pieza | Local (plan B de la defensa) | Nube |
|---|---|---|
| Backend | Laptop, `npm run dev`, `http://192.168.137.1:3000` | Render Web Service (Virginia) |
| Base de datos | MongoDB en la laptop | MongoDB Atlas M0 (us-east-1) |
| Web | `npm run dev` (Vite, puerto 5173) | Render Static Site |
| Reloj | variante `local` (http al hotspot) | variante `cloud` (HTTPS) |
| Visor | `BaseUrl` = hotspot | `BaseUrl` = Render (ver `CONTRATO_VISOR.md`) |

## 0. Antes de empezar

- Los dos repos (`vr-therapy-backend`, `theralink-web`) deben estar en GitHub, con el
  trabajo en la rama por defecto (`main`): Render despliega esa rama.
- Atlas: en **Network Access** agrega las IP de salida de Render (en el servicio:
  *Connect → Outbound*) o, más simple para el proyecto, `0.0.0.0/0` con una
  contraseña fuerte. Sin esto el backend no conecta y `/health` responde 503.
- La URI de Atlas debe llevar el nombre de la base al final:
  `mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/theralink`.

## 1. Sembrar la base de Atlas (una vez)

Desde la laptop, en `vr-therapy-backend`:

1. Crea el archivo `.env.cloud` (git lo ignora) con una sola línea:
   ```
   MONGODB_URI=mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/theralink
   ```
2. Corre:
   ```bash
   npm run seed:cloud
   ```

Siembra **solo** los 3 environments, los 9 escenarios, los dispositivos (Quest y
reloj, con device keys nuevas, distintas de las locales) y un terapeuta demo. No
copia pacientes, sesiones ni cuentas de QA. Es idempotente: se puede correr otra
vez sin duplicar nada ni cambiar las keys.

Las credenciales quedan en **`.cloud-credentials.md`** (git lo ignora): correo y
contraseña del terapeuta demo y las device keys del Quest y del reloj.

Opciones: `--email=<correo>`, `--name="<nombre>"`, `--reset-demo-password`.

## 2. Backend en Render

1. Render → **New → Blueprint** → elige el repo `vr-therapy-backend`. Render lee
   `render.yaml` (web service Node, región Virginia, plan Free, health check `/health`).
2. Te pide las variables marcadas `sync: false`:

   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la URI de Atlas (la misma de `.env.cloud`) |
   | `JWT_SECRET` | uno nuevo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `CORS_ORIGINS` | la URL de la web en Render, sin barra final (paso 3). Si aún no existe, pon `https://theralink-web.onrender.com` y corrígela después |

   `NODE_ENV=production` ya viene en `render.yaml`. `PORT` lo pone Render.
3. Al terminar el deploy, abre `https://<backend>.onrender.com/health`. Debe responder
   `{"status":"ok","db":"connected",...}`. Si dice `disconnected` (503), revisa la URI y
   el Network Access de Atlas.

Sin `JWT_SECRET` o `MONGODB_URI` el servidor **no arranca** en producción (el log lo dice).

## 3. Web en Render

1. Render → **New → Blueprint** → repo `theralink-web` (Static Site, publica `dist`,
   con la regla de reescritura `/* → /index.html` para que recargar
   `/terapeuta/pacientes` no dé 404).
2. Variable `VITE_API_URL` = `https://<backend>.onrender.com/api` (con `/api`).
   Vite la usa **al compilar**: si la cambias, hay que volver a desplegar
   (*Manual Deploy → Deploy latest commit*).
3. Copia la URL final de la web y ponla en `CORS_ORIGINS` del backend (*Environment*).
   Guardar reinicia el backend. Varias URL van separadas por comas.

Si el nombre `theralink-web` o `theralink-backend` ya está ocupado, Render le agrega
un sufijo: usa siempre las URL que muestra el dashboard.

## 4. Reloj y visor

- **Reloj:** en `theralink-watch`, copia `theralink.properties.example` a
  `theralink.properties` y llena `cloud.serverUrl` (`https://<backend>.onrender.com`,
  sin `/api`) y `cloud.deviceKey` (fila "Galaxy Watch" de `.cloud-credentials.md`).
  Instala con `gradlew installCloudDebug`. En la nube el reloj necesita una Wi-Fi
  con salida a internet.
- **Visor:** ver `CONTRATO_VISOR.md`, sección "Cambiar a la nube".

## 5. Plan Free ↔ Starter

El plan Free **duerme el backend tras 15 minutos sin peticiones** y tarda hasta un
minuto en despertar. La web muestra "Conectando con el servidor…" mientras tanto.
Durante una sesión no se duerme: el visor hace polling cada 1–3 s.

- **Subir a Starter** (días de prueba y defensa): servicio `theralink-backend` →
  *Settings → Instance Type → Starter → Save*. No duerme. Se cobra prorrateado por el
  tiempo que esté activo.
- **Volver a Free:** mismo lugar → *Free → Save*.
- Antes de una demo en plan Free: abre la web un par de minutos antes para despertarlo.

Cambiar de plan redespliega el servicio (unos segundos sin servicio): no hacerlo con
una sesión en curso.

## 6. Logs y diagnóstico

- **Logs:** servicio → *Logs*. Cada petición sale como
  `fecha MÉTODO ruta → status (ms)` (salvo `/health`). Al arrancar muestra el host de
  Mongo (sin credenciales) y la lista de CORS.
- **Estado:** `GET /health` → `db: connected | disconnected`, `uptime` en segundos.
  Un `uptime` bajo indica que el servicio acaba de despertar o reiniciarse.
- **La web no carga datos y la consola dice CORS:** falta la URL de la web en
  `CORS_ORIGINS` (exacta, con `https://` y sin barra final).
- **Reloj o visor reciben 403:** están usando la device key local; las de la nube son
  las de `.cloud-credentials.md`.

## 7. Volver al modo local (plan B)

No hay que deshacer nada: lo local sigue igual.

1. Laptop: enciende el hotspot y MongoDB; en `vr-therapy-backend` corre `npm run dev`
   (usa `.env`: Mongo local y CORS de localhost + hotspot).
2. Web: `npm run dev` en `theralink-web` (usa `.env.development`; para abrirla desde
   el teléfono, `.env.development.local` con `http://192.168.137.1:3000/api`).
3. Reloj: `gradlew installLocalDebug` (misma app; reemplaza a la variante cloud).
4. Visor: instalar el APK local (`BaseUrl` y `DeviceKey` locales).

Los datos de la nube y los locales son **bases distintas**: los pacientes y sesiones
no se copian entre un modo y otro.

## Variables de entorno

| Servicio | Variable | Local | Nube |
|---|---|---|---|
| Backend | `NODE_ENV` | (sin definir) | `production` |
| Backend | `PORT` | `3000` | lo inyecta Render |
| Backend | `MONGODB_URI` | `mongodb://localhost:27017/vr-therapy` | URI de Atlas |
| Backend | `JWT_SECRET` | en `.env` | en Render (obligatoria) |
| Backend | `JWT_EXPIRES_IN` | en `.env` (default `12h`) | opcional |
| Backend | `CORS_ORIGINS` | vacío = localhost y hotspot | URL de la web |
| Web | `VITE_API_URL` | `http://localhost:3000/api` | `https://<backend>.onrender.com/api` |
| Reloj | `cloud.serverUrl`, `cloud.deviceKey` | — | `theralink.properties` |
| Visor | `BaseUrl`, `DeviceKey` | hotspot + key local | Render + key de la nube |
