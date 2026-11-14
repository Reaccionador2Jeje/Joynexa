# Joynexa

**The Gaming Universe** — una superplataforma gaming de AtDev para descubrir videojuegos, explorar comunidades y conectar experiencias de juego desde un único sitio web.

> Estado: primera base funcional en desarrollo (0.1.0-alpha).

## Estructura

- Sitio único responsive: HTML, CSS y JavaScript nativo.
- API: Cloudflare Workers en src/index.js.
- Base de datos: Cloudflare D1 con migración inicial en migrations/0001_initial.sql.
- Configuración de despliegue: wrangler.toml.

## Funciones disponibles en esta versión

- Inicio, navegación móvil, búsqueda y filtros del catálogo.
- Joynexa ID: registro, inicio y cierre de sesión mediante API.
- Contraseñas protegidas con PBKDF2-SHA-256 y salt individual.
- Sesiones con cookies HttpOnly, Secure y SameSite=Lax.
- Catálogo API que solo devuelve juegos aprobados.
- Formulario para enviar juegos a una cola privada de revisión.
- Tablas preparadas para favoritos, logros y moderación.

Las tarjetas de ejemplo no son juegos publicados. Los juegos enviados no se ejecutan ni se publican automáticamente.

## Configuración local y Cloudflare

1. Instala Node.js y Wrangler en un entorno de desarrollo.
2. Crea una base D1 llamada joynexa-db.
3. Copia el ID de D1 en wrangler.toml, reemplazando el valor de ejemplo.
4. Ejecuta: npx wrangler d1 migrations apply joynexa-db --remote
5. Configura APP_ORIGIN con el origen exacto del sitio publicado.
6. Despliega la API: npx wrangler deploy
7. Publica el frontend con Cloudflare Pages conectado a este repositorio.

Si frontend y API se publican en dominios distintos, configura window.JOYNEXA_API_URL antes de cargar app.js para apuntar al origen de la API. Para evitar problemas de cookies entre sitios, se recomienda usar un dominio propio y enrutar la API bajo el mismo sitio.

Consulta docs/PLATFORM_STATUS.md para conocer límites y tareas pendientes.

## Seguridad y publicación

Joynexa está pensado para una comunidad que incluye menores. Antes de abrir el registro al público se necesitan revisión legal y de privacidad, controles de edad/consentimiento apropiados, recuperación de cuentas, limitación de intentos, protección antiabuso y revisión de seguridad. No hay chat público ni mensajes privados.

Los enlaces de juegos son envíos pendientes. Antes de alojar o incrustar contenido externo se requieren revisión de licencias, seguridad, aislamiento de origen y políticas de sandbox.

## Próximas etapas

1. Panel seguro de moderación y publicación.
2. SDK de juegos para logros y guardados compatibles.
3. Favoritos sincronizados y perfil ampliado.
4. Eventos y funciones sociales con controles de seguridad.
5. Revisión de accesibilidad, privacidad y pruebas automatizadas.

## Filosofía

Joynexa prioriza accesibilidad, apertura y libertad digital. Las publicaciones de juegos deberán pasar por revisión antes de estar disponibles.

Desarrollado por **AtDev**.
