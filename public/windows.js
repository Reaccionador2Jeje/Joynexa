const statusNode = document.getElementById("release-status");
const listNode = document.getElementById("release-list");
const yearNode = document.getElementById("year");

if (yearNode) yearNode.textContent = String(new Date().getFullYear());

function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function safeReleaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.href : null;
  } catch {
    return null;
  }
}

function addAsset(asset) {
  const href = safeReleaseUrl(asset.browser_download_url);
  if (!href) return;

  const item = document.createElement("div");
  item.className = "release-item";

  const details = document.createElement("div");
  const name = document.createElement("b");
  name.textContent = asset.name;
  const size = document.createElement("small");
  size.textContent = formatBytes(asset.size);
  details.append(name, size);

  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Descargar ↗";

  item.append(details, link);
  listNode.append(item);
}

async function loadReleases() {
  if (!statusNode || !listNode) return;

  try {
    const response = await fetch(
      "https://api.github.com/repos/Reaccionador2Jeje/Joynexa/releases?per_page=20",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!response.ok) throw new Error("GitHub Releases no está disponible.");

    const releases = await response.json();
    const release = releases.find((item) =>
      typeof item.tag_name === "string" &&
      item.tag_name.startsWith("windows-v") &&
      !item.draft &&
      !item.prerelease
    );

    if (!release) {
      statusNode.textContent =
        "Todavía no hay paquetes de Windows publicados. Esta sección se actualizará cuando se publique una versión.";
      return;
    }

    const assets = (release.assets || []).filter((asset) =>
      asset.name.endsWith(".zip") || asset.name === "SHA256SUMS"
    );

    for (const asset of assets) addAsset(asset);

    if (!listNode.childElementCount) {
      statusNode.textContent =
        "La publicación existe, pero no contiene archivos descargables válidos.";
      return;
    }

    statusNode.textContent = release.name || release.tag_name;
  } catch {
    statusNode.textContent =
      "No se pudo cargar la lista automáticamente. Puedes consultar las publicaciones directamente en GitHub.";
  }
}

loadReleases();
