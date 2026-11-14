# Joynexa

**The Gaming Universe** — una superplataforma gaming de AtDev para descubrir videojuegos, explorar comunidades y conectar experiencias de juego desde un único sitio web.

> Estado: base funcional 0.1.0-alpha en desarrollo.

## Arquitectura

- Un solo sitio web responsive, servido con Cloudflare Workers Static Assets.
- API en Cloudflare Workers: src/index.js.
- Base de datos Cloudflare D1: joynexa-db.
- Configuración de despliegue en wrangler.toml.
- Código fuente del frontend en la raíz y copia de publicación en public/.

## Funciones implementadas

- Inicio, navegación móvil, búsqueda y filtros del catálogo.
- Joynexa ID: registro, inicio, cierre de sesión y consulta de sesión mediante API.
- Contraseñas con PBKDF2-SHA-256 y salt individual.
- Sesiones con cookies HttpOnly, Secure y SameSite=Lax.
- Catálogo API que solo muestra juegos aprobados.
- Formulario para enviar juegos a una cola privada de revisión.
- Esquema D1 preparado para logros, favoritos y moderación.
- Workflow de GitHub Actions para revisar sintaxis JavaScript.

Las tarjetas de muestra no son juegos publicados. Los envíos no se publican ni ejecutan automáticamente.

## Base de datos

La base D1 joynexa-db ya fue creada en la cuenta Cloudflare conectada y su esquema inicial fue aplicado. El identificador está configurado en wrangler.toml.

Para volver a aplicar migraciones desde un entorno de desarrollo con Wrangler:

npx wrangler d1 migrations apply joynexa-db --remote

## Despliegue

El proyecto está configurado para servir frontend y API desde el mismo Worker, manteniendo las cookies de sesión en el mismo origen.

Con Wrangler instalado y autenticado en la cuenta Cloudflare:

npx wrangler deploy

También puedes conectar el repositorio a Cloudflare Workers Builds para automatizar los despliegues desde main. No subas tokens ni secretos al repositorio.

## Seguridad y publicación

Joynexa está pensado para una comunidad que incluye menores. Antes de abrir el registro al público se necesitan revisión legal y de privacidad, controles de edad y consentimiento apropiados, recuperación de cuentas, limitación de intentos, protección antiabuso y pruebas de seguridad. No hay chat público ni mensajes privados.

Los juegos enviados permanecen pendientes. Antes de alojar o incrustar contenido externo se requieren revisión de licencias, contenido, aislamiento de origen y políticas de sandbox.

## Próximas etapas

1. Panel de moderación seguro para revisar y aprobar juegos.
2. SDK para logros y guardados en juegos compatibles.
3. Favoritos sincronizados y perfiles ampliados.
4. Eventos y funciones sociales con controles de seguridad.
5. Pruebas automatizadas, accesibilidad y revisión de privacidad.

## Filosofía

Joynexa prioriza accesibilidad, apertura y libertad digital. Las publicaciones de juegos deberán pasar por revisión antes de estar disponibles.

Desarrollado por **AtDev**.
