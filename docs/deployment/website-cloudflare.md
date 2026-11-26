# Publicación del sitio Joynexa

El sitio está configurado como Worker **`joynexa`** con Static Assets en `./public`. El workflow `.github/workflows/deploy-joynexa.yml` publica el Worker y los archivos estáticos mediante Wrangler.

## Configuración inicial

En GitHub, abre **Settings → Secrets and variables → Actions** y crea estos dos *repository secrets*:

- `CLOUDFLARE_API_TOKEN`: token de Cloudflare limitado a la cuenta Atdev y con permisos de despliegue de Workers.
- `CLOUDFLARE_ACCOUNT_ID`: ID de la cuenta Atdev.

No publiques el token en el repositorio, en issues ni en conversaciones. No uses una Global API Key.

## Desplegar

1. Abre **Actions → Deploy Joynexa Website**.
2. Pulsa **Run workflow** sobre la rama `main`.
3. Espera el resultado `success`.
4. Comprueba el sitio y la ruta `/windows.html` desde el dominio público configurado.

El workflow es manual intencionalmente: si los secretos no están configurados, no debe ejecutarse un despliegue fallido en cada push. El Worker existente usa el binding D1 `DB`, el binding de assets `ASSETS` y el backend `ACCOUNTS_API_URL`. Wrangler aplica la configuración de `wrangler.toml`; los secretos existentes del Worker deben permanecer gestionados desde Cloudflare.

## Qué se publica

Se publica el código propio del sitio y los assets de `public/`. Esto no crea ni distribuye una ISO de Windows. Los medios de instalación de Windows deben obtenerse directamente de Microsoft y respetar sus licencias y requisitos oficiales.
