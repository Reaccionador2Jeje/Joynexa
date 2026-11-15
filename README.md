# Joynexa

**The Gaming Universe** — superplataforma gaming de AtDev para descubrir videojuegos, explorar comunidades y conectar experiencias desde un único sitio.

> Estado: 0.3.0-alpha · Migración de Joynexa ID a Node.js en preparación.

## Arquitectura

- Frontend y API gateway: Cloudflare Workers Static Assets.
- Backend de cuentas: Node.js 22 + TypeScript + Fastify.
- Base de datos de cuentas: PostgreSQL.
- Persistencia de catálogo y moderación: Cloudflare D1 (por ahora).
- Entorno local: Docker Compose.
- Contraseñas nuevas: Argon2id.
- Contraseñas heredadas: PBKDF2-SHA256 verificadas y actualizadas a Argon2id en el primer inicio de sesión correcto.

El frontend conserva las mismas rutas `/api/register`, `/api/login`, `/api/logout` y `/api/me`. Cuando se configura `ACCOUNTS_API_URL`, el Worker las reenvía al backend Node.js. Sin esa variable, la API heredada D1 sigue funcionando como respaldo.

## Funciones

- Catálogo de juegos publicados tras moderación.
- Joynexa ID: registro, inicio, cierre y consulta de sesión.
- Migración de cuentas D1 preservando IDs, nombres, roles y hashes de contraseña.
- Conversión progresiva de hashes PBKDF2 a Argon2id tras un inicio de sesión correcto.
- Envíos de juegos a una cola de revisión.
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
| GET | `/api/admin/setup-status` | Comprobar configuración inicial |
| POST | `/api/admin/bootstrap` | Activar el primer administrador una sola vez |

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

### Despliegue

El repositorio no despliega por sí solo el backend Node.js. Debes elegir un proveedor que ejecute contenedores Docker y ofrezca una URL HTTPS, configurar PostgreSQL administrado o una base persistente con copias de seguridad, y establecer las variables anteriores.

No conectes el sitio público a un backend sin TLS, sin secretos de producción o sin haber probado primero la importación. El Worker debe apuntar a una URL pública HTTPS; `localhost` solo sirve para desarrollo local.

## Seguridad y límites

- Las contraseñas no se guardan en texto plano.
- Los tokens de sesión son aleatorios; PostgreSQL almacena sus hashes.
- Las cookies de sesión son HttpOnly, SameSite=Lax y Secure en producción.
- Las rutas de escritura verifican el origen cuando se envía la cabecera Origin.
- Hay límites de solicitudes, validación de entradas y respuestas de error sin detalles internos.
- No se importan sesiones antiguas.
- Aún faltan recuperación de cuentas, verificación de correo, MFA, gestión de sesiones y pruebas de seguridad adicionales.
- No habilitar mensajes privados ni chat público hasta implementar moderación y protección apropiadas.

Joynexa está pensado para una comunidad que incluye menores. Antes de abrirlo al público se requieren políticas de privacidad, controles de seguridad y moderación, y revisión legal apropiada.

## CI

GitHub Actions comprueba sintaxis JavaScript, tipos TypeScript, compilación de la API y construcción de la imagen Docker.

## Filosofía

Joynexa prioriza accesibilidad, apertura y libertad digital. Los juegos enviados permanecen pendientes hasta superar la revisión.

Desarrollado por **AtDev**.
