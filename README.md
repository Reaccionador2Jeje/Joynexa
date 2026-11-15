# Joynexa

**The Gaming Universe** — superplataforma gaming de AtDev para descubrir videojuegos, explorar comunidades y conectar experiencias desde un único sitio.

> Estado: 0.3.0-alpha · Migración de Joynexa ID a Node.js en preparación.

## Arquitectura

- Frontend y API gateway: Cloudflare Workers Static Assets.
- Backend de cuentas: Node.js 22 + TypeScript + Fastify.
- Base de datos de cuentas: PostgreSQL.
- Persistencia de catálogo, moderación y favoritos: Cloudflare D1 (por ahora).
- Entorno local: Docker Compose.
- Contraseñas nuevas: Argon2id.
- Contraseñas heredadas: PBKDF2-SHA256 verificadas y actualizadas a Argon2id en el primer inicio de sesión correcto.

El frontend conserva las mismas rutas `/api/register`, `/api/login`, `/api/logout` y `/api/me`. Cuando se configura `ACCOUNTS_API_URL`, el Worker las reenvía al backend Node.js. Sin esa variable, la API heredada D1 sigue funcionando como respaldo.

## Catálogo gaming

- La vista inicial prioriza experiencias completas y deja los minijuegos clásicos en «Todo el catálogo».
- Catálogo paginado de 36 juegos por página, preparado para miles de registros.
- Búsqueda por título, descripción, género y creador.
- Géneros ampliados: simulación, carreras, sandbox, estrategia, aventura, arcade y puzzle.

## Funciones

- Catálogo de juegos publicados tras moderación, con favoritos personales almacenados mediante el Joynexa ID universal.
- Catálogo con 140 títulos clásicos y 17 experiencias destacadas más completas: simulación, carreras 3D, sandbox voxel, gestión, construcción y plataformas. Joynexa enlaza a los alojamientos originales y conserva la atribución; no copia ni redistribuye sus archivos.
- Joynexa ID: registro, inicio, cierre y consulta de sesión.
- Perfiles Joynexa ID: nombre visible, biografía breve, avatares predeterminados y publicación opcional con privacidad activada por defecto.
- Migración de cuentas D1 preservando IDs, nombres, roles y hashes de contraseña.
- Conversión progresiva de hashes PBKDF2 a Argon2id tras un inicio de sesión correcto.
- Envíos de juegos a una cola de revisión con historial privado de estados para cada desarrollador.
- Panel de administración con comprobación de permisos en servidor.
- Sesiones con cookies HttpOnly y tokens almacenados como hashes.

## Joynexa Accounts API

| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Estado de la API y conexión PostgreSQL |
| POST | `/api/register` | Crear cuenta e iniciar sesión |
| POST | `/api/login` | Iniciar sesión |
| POST | `/api/logout` | Cerrar sesión |
| GET | `/api/me` | Consultar cuenta actual |
| GET | `/api/profile/me` | Consultar el perfil propio |
| PUT | `/api/profile/me` | Editar el perfil propio |
| GET | `/api/users/:username/profile` | Consultar un perfil público (solo si está publicado) |
| GET | `/api/admin/setup-status` | Comprobar configuración inicial |
| POST | `/api/admin/bootstrap` | Activar el primer administrador una sola vez |

### Perfiles Joynexa ID

Los perfiles existentes se crean como privados. Cada usuario puede elegir un nombre visible, una biografía de hasta 160 caracteres y uno de los avatares incluidos. La publicación es voluntaria; los perfiles privados responden como no disponibles a las consultas públicas. El backend rechaza enlaces y datos de contacto evidentes en el nombre visible y la biografía. No se muestran el correo, el Joynexa ID interno ni datos de sesión.

### Ejecutar localmente

Requisitos: Node.js 22, Docker y Docker Compose.

1. Inicia PostgreSQL y la API:

   ```bash
   docker compose up --build
   ```

2. Comprueba la API:

   ```bash
   curl http://localhost:3001/health
   ```

3. La API queda en `http://localhost:3001`; PostgreSQL escucha solo en `127.0.0.1:5432`.

4. Para conectar el Worker local, copia `.dev.vars.example` a `.dev.vars`. Asegúrate de que `ACCOUNTS_API_URL=http://localhost:3001` y ejecuta Wrangler en el puerto 8787:

   ```bash
   npx wrangler dev --port 8787
   ```

5. El origen permitido por defecto en Compose es `http://localhost:8787`. Para cambiarlo, define `FRONTEND_ORIGIN`.

Las credenciales predeterminadas de Docker Compose son solo para desarrollo local. Define `POSTGRES_PASSWORD` en un archivo `.env` de la raíz antes de usar una base persistente fuera de pruebas. No reutilices la contraseña de ejemplo en producción.

### Migrar cuentas existentes desde D1

La migración no elimina ni modifica los datos de D1. Primero importa las cuentas a PostgreSQL y valida los resultados.

1. Inicia PostgreSQL con `docker compose up -d accounts-db`.
2. Crea una exportación local de los campos necesarios:

   ```bash
   npx wrangler d1 execute joynexa-db --remote --command "SELECT id, username, password_hash, password_salt, role, status FROM users;" --json > legacy-users.json
   ```

3. Copia la configuración de conexión para el importador:

   ```bash
   cp server/.env.example server/.env
   ```

   Si cambiaste `POSTGRES_PASSWORD`, actualiza `DATABASE_URL` en `server/.env` para que coincida.

4. Instala dependencias y ejecuta la importación:

   ```bash
   cd server
   npm install
   npm run import:legacy -- ../legacy-users.json
   cd ..
   ```

5. Revisa el resumen de cuentas importadas y omitidas. Conserva la exportación en un lugar privado y seguro; no la subas a GitHub ni la compartas. Contiene hashes de contraseñas.
6. No borres D1 ni su tabla de usuarios durante la transición.

El importador conserva el ID original, nombre de usuario, rol, estado y hash PBKDF2. No importa sesiones activas: todos tendrán que iniciar sesión nuevamente. En el primer acceso correcto, el backend verifica el hash heredado y lo reemplaza por Argon2id. Las cuentas nuevas usan Argon2id desde el principio.

### Conectar el Worker con el backend

**Solo después de desplegar la API Node.js en un host HTTPS y completar la importación:**

1. Configura en el backend:
   - `DATABASE_URL`: conexión PostgreSQL de producción.
   - `FRONTEND_ORIGIN`: origen HTTPS exacto del sitio Joynexa.
   - `NODE_ENV=production`.
   - `ADMIN_SETUP_KEY`: clave aleatoria temporal para activar el primer administrador, si no hay uno importado.

2. Configura el secreto del Worker con la URL base HTTPS del backend (sin rutas):

   ```bash
   npx wrangler secret put ACCOUNTS_API_URL
   ```

3. Despliega el Worker:

   ```bash
   npx wrangler deploy
   ```

4. Prueba registro, inicio, cierre, `/api/me`, envío de juegos y acceso al panel de administración.
5. Si la base migrada no contiene un administrador, activa el primero desde `/admin.html` con la clave temporal. Después elimina `ADMIN_SETUP_KEY` del entorno del backend.
6. Conserva D1 como respaldo hasta verificar el funcionamiento completo y tener una copia de seguridad.

El proxy mantiene las rutas actuales del frontend. También consulta la nueva API para autorizar envíos de juegos y acciones de administración, mientras los juegos y eventos de moderación siguen en D1. Así la migración de cuentas no obliga a migrar todo el catálogo de una vez.

### Despliegue del backend en Render (pruebas)

El repositorio incluye `render.yaml` para crear el servicio `joynexa-accounts` en el plan gratuito de Render, región Virginia, cerca de la región de Supabase. Es una configuración de pruebas: el servicio gratuito se duerme tras 15 minutos sin tráfico y puede tardar alrededor de un minuto en despertar. No se recomienda como backend de producción.

1. En Render, crea un Blueprint desde este repositorio y revisa que solo vaya a crear el servicio web `joynexa-accounts`.
2. Cuando Render solicite las variables privadas, añade:
   - `DATABASE_URL`: URI PostgreSQL del **Session pooler** de Supabase para el proyecto Atdev OS Hub. Usa la cadena de conexión desde Project Settings → Database; no la pegues en GitHub ni en el chat.
   - `ADMIN_SETUP_KEY` se genera automáticamente por Render. Solo se necesita para configurar el primer administrador si no se importó ninguna cuenta administradora.
3. Espera a que el despliegue termine y comprueba `https://<servicio>.onrender.com/health`. Debe responder con `ok: true`.
4. En Cloudflare, configura `ACCOUNTS_API_URL` con el origen HTTPS del servicio (por ejemplo, `https://<servicio>.onrender.com`) y vuelve a desplegar el Worker.
5. Comprueba `/api/health` en el sitio Joynexa: `accountsBackend` debe indicar `connected`.

La API ejecuta las migraciones al iniciar. La conexión debe usar el usuario PostgreSQL propietario de la base, nunca una clave `anon` ni una credencial pública. El secreto `DATABASE_URL` solo vive en las variables privadas de Render.

El plan gratuito de Render es solo para pruebas: duerme tras inactividad y no ofrece garantías de disponibilidad. Supabase conserva los datos de PostgreSQL, pero antes de migrar cuentas reales debes tener copias de seguridad y verificar la importación. No borres la base D1 durante esta etapa.

## Despliegue

El repositorio no despliega por sí solo el backend Node.js. Debes elegir un proveedor que ejecute contenedores Docker y ofrezca una URL HTTPS, configurar PostgreSQL administrado o una base persistente con copias de seguridad, y establecer las variables anteriores.

No conectes el sitio público a un backend sin TLS, sin secretos de producción o sin haber probado primero la importación. El Worker debe apuntar a una URL pública HTTPS; `localhost` solo sirve para desarrollo local.

## Seguridad y límites

- Las contraseñas no se guardan en texto plano.
- Los tokens de sesión son aleatorios; PostgreSQL almacena sus hashes.
- Las cookies de sesión son HttpOnly, SameSite=Lax y Secure en producción.
- Las rutas de escritura verifican el origen cuando se envía la cabecera Origin.
- Hay límites de solicitudes, validación de entradas y respuestas de error sin detalles internos.
- No se importan sesiones antiguas.
- Aún faltan recuperación de cuentas, verificación de correo, MFA, herramientas de moderación de perfiles y pruebas de seguridad adicionales.
- No habilitar mensajes privados ni chat público hasta implementar moderación y protección apropiadas.

Joynexa está pensado para una comunidad que incluye menores. Antes de abrirlo al público se requieren políticas de privacidad, controles de seguridad y moderación, y revisión legal apropiada.

## Joynexa Achievements + Game SDK

- Colección privada de logros del jugador y puntos acumulados.
- Cliente Node.js de servidor en `sdk/` para otorgar logros sin exponer claves al juego cliente.
- Los desarrolladores de juegos aprobados pueden definir logros y generar una clave privada de servidor.
- Las claves se almacenan como hashes en D1 y solo se muestran al generarse.
- El endpoint de entrega es idempotente: no duplica un logro ya obtenido.
- Los IDs de cuenta son texto universal y no dependen de la tabla heredada de usuarios D1.

Rutas principales:
- `GET /api/achievements/me`
- `POST /api/developer/games/:slug/achievements`
- `POST /api/developer/games/:slug/sdk-key`
- `POST /api/sdk/games/:slug/achievements/:code`

Guía de integración: [docs/GAME_SDK.md](docs/GAME_SDK.md).

**Importante:** la clave del SDK solo se usa desde un backend privado. Nunca debe incluirse en JavaScript del navegador ni en una aplicación distribuida al usuario. El backend del juego es responsable de comprobar que se cumplieron las condiciones del logro.

### Aplicar migración D1

Aplica las migraciones D1 pendientes al binding `joynexa-db`. La migración `0004` crea las tablas de logros y SDK; `0005` añade 140 juegos HTML5 externos con enlaces a sus sitios originales:

```bash
npx wrangler d1 migrations apply joynexa-db --remote
```

Revisa el SQL y confirma el entorno antes de ejecutarlo. La migración crea tablas nuevas y no elimina las tablas anteriores. El despliegue del Worker y la aplicación de migraciones son pasos separados.

### Catálogo externo de juegos

El catálogo inicial incluye 140 juegos de dos proyectos con licencia MIT. Los juegos se abren en el alojamiento original de cada autor; Joynexa no copia sus archivos ni los presenta como creaciones propias. Las entradas del catálogo externo se publican directamente; los envíos de la comunidad siguen pasando por moderación.

Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para conocer las fuentes y atribuciones.

## CI

GitHub Actions comprueba sintaxis JavaScript, tipos TypeScript, compilación de la API y construcción de la imagen Docker. El workflow `Joynexa Game SDK` ejecuta `npm test` con Node.js 22 cuando cambian los archivos del SDK.

## Filosofía

Joynexa prioriza accesibilidad, apertura y libertad digital. Los juegos enviados permanecen pendientes hasta superar la revisión.

Desarrollado por **AtDev**.
