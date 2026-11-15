# Joynexa

**The Gaming Universe** — una superplataforma gaming de AtDev para descubrir videojuegos, explorar comunidades y conectar experiencias de juego desde un único sitio web.

> Estado: 0.2.0-alpha · Arquitectura de cuentas en construcción.

## Arquitectura actual

- Frontend responsive servido con Cloudflare Workers Static Assets.
- API y catálogo heredados en Cloudflare Workers: `src/index.js`.
- Base de datos heredada: Cloudflare D1 (`joynexa-db`).
- Nueva API de cuentas en Node.js + TypeScript: `server/`.
- Nueva base de datos de cuentas: PostgreSQL.
- Entorno local reproducible con Docker Compose.

La API Node.js se está construyendo en paralelo. **El frontend todavía utiliza la API heredada de Cloudflare Workers**; no se ha cambiado el inicio de sesión de producción ni se ha migrado información de usuarios. El cambio se hará después de probar la nueva API y preparar la migración de datos.

## Funciones existentes

- Catálogo con búsqueda, filtros y publicación solo después de moderación.
- Joynexa ID heredado: registro, inicio, cierre de sesión y consulta de sesión.
- Envíos de juegos a una cola privada de revisión.
- Panel de administración con permisos verificados en el servidor.
- Base de datos D1 con usuarios, sesiones, juegos y eventos de moderación.

## Joynexa Accounts API (nueva)

Tecnologías:

- Node.js 22 + TypeScript.
- Fastify para la API HTTP.
- PostgreSQL para cuentas y sesiones.
- Argon2id para almacenar contraseñas.
- Cookies HttpOnly y sesiones opacas cuyos tokens se guardan como hashes.
- Validación de entradas con Zod, CORS con lista de orígenes permitidos, Helmet y límites de solicitudes.
- Docker Compose para ejecutar API y base de datos localmente.

Rutas iniciales:

| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Estado de la API y conexión con PostgreSQL |
| POST | `/api/register` | Crear cuenta e iniciar sesión |
| POST | `/api/login` | Iniciar sesión |
| POST | `/api/logout` | Cerrar sesión |
| GET | `/api/me` | Consultar la cuenta autenticada |

### Ejecutar localmente

Requisitos: Docker con Docker Compose.

1. En la raíz del repositorio, ejecuta:

   ```bash
   docker compose up --build
   ```

2. Comprueba el estado de la API:

   ```bash
   curl http://localhost:3001/health
   ```

3. La API queda disponible en `http://localhost:3001` y PostgreSQL en el puerto local `5432`.

Para cambiar el origen permitido del frontend, define `FRONTEND_ORIGIN` antes de iniciar Compose. El valor local predeterminado es `http://localhost:8787`. Las credenciales predeterminadas de Compose son exclusivamente para desarrollo local: cámbialas antes de cualquier despliegue y no reutilices esa contraseña en producción.

Para desarrollo sin Docker, entra en `server/`, instala dependencias con `npm install`, configura las variables de entorno tomando `.env.example` como referencia y ejecuta `npm run migrate` y `npm run dev`.

### Seguridad y límites de esta versión

- No se almacenan contraseñas en texto plano.
- El navegador recibe una cookie HttpOnly; la base de datos guarda el hash del token de sesión, no el token original.
- El registro limita los nombres de usuario a 3–20 caracteres y las contraseñas a 10–128.
- Las rutas de escritura verifican el origen cuando el navegador envía la cabecera Origin.
- Los límites de solicitudes y las respuestas de error reducen abuso y filtración de detalles internos.
- Esta versión todavía no incluye recuperación de cuentas, verificación de correo, MFA, cierre de todas las sesiones ni panel de gestión de sesiones.
- Antes de producción se requieren pruebas de seguridad, configuración de secretos, TLS, copias de seguridad y políticas de privacidad adecuadas.

## Base de datos heredada D1

La base D1 `joynexa-db` existente se mantiene para el backend heredado. Su esquema no se ha eliminado ni modificado por la nueva API.

Aplicar migraciones heredadas con Wrangler:

```bash
npx wrangler d1 migrations apply joynexa-db --remote
```

## Despliegue del frontend heredado

Con Wrangler instalado y autenticado en Cloudflare:

```bash
npx wrangler deploy
```

La API Node.js aún no está desplegada ni conectada al frontend. No se debe apuntar el frontend público a ella hasta configurar un dominio HTTPS, secretos de producción, PostgreSQL administrado y la migración de cuentas.

## Activar el primer administrador heredado

1. Genera una clave aleatoria: `openssl rand -hex 32`.
2. Configúrala como secreto del Worker: `npx wrangler secret put ADMIN_SETUP_KEY`.
3. Despliega el Worker e inicia sesión con tu cuenta Joynexa ID.
4. Abre `/admin.html`, introduce la clave una sola vez y activa esa cuenta como administrador.
5. Después de confirmar que el panel funciona, elimina el secreto con `npx wrangler secret delete ADMIN_SETUP_KEY`.

**No guardes claves ni tokens en GitHub, archivos del proyecto o capturas públicas.**

## Seguridad y publicación

Joynexa está pensado para una comunidad que incluye menores. Antes de abrir el registro al público se necesitan revisión legal y de privacidad, controles de edad y consentimiento apropiados, recuperación de cuentas, protección antiabuso y pruebas de seguridad. No hay chat público ni mensajes privados habilitados.

Los juegos enviados permanecen pendientes. Antes de alojar o incrustar contenido externo se requieren revisión de licencias, contenido, aislamiento de origen y políticas de sandbox.

## Próximas etapas

1. Probar Joynexa Accounts API con PostgreSQL y Docker.
2. Diseñar y probar la migración de cuentas desde D1, sin perder contraseñas ni sesiones por accidente.
3. Conectar el frontend y el Worker a la nueva API mediante un origen HTTPS seguro.
4. Migrar gradualmente juegos, moderación y perfiles.
5. Añadir recuperación de cuentas, pruebas automatizadas y controles adicionales.

## Filosofía

Joynexa prioriza accesibilidad, apertura y libertad digital. Las publicaciones de juegos deberán pasar por revisión antes de estar disponibles.

Desarrollado por **AtDev**.
