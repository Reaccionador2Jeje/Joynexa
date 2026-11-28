(() => {
  const releasesUrl = "https://api.github.com/repos/Reaccionador2Jeje/Joynexa/releases/latest";
  const targets = {
    windows: { match: /windows|win64|win-x64|setup.*\\.exe|\\.msi$/i, label: "Windows" },
    linux: { match: /linux|appimage|\\.deb$|\\.rpm$/i, label: "Linux" },
    android: { match: /android|\\.apk$/i, label: "Android" }
  };
  const setStatus = (platform, text) => {
    const node = document.getElementById("status-" + platform);
    if (node) node.textContent = text;
  };
  const setDownload = (platform, asset, release) => {
    const link = document.getElementById("download-" + platform);
    if (!link) return;
    link.href = asset.browser_download_url;
    link.textContent = "Descargar " + targets[platform].label + " ↓";
    link.removeAttribute("target");
    link.removeAttribute("rel");
    setStatus(platform, asset.name + " · " + (asset.size / 1048576).toFixed(1) + " MB");
  };
  async function loadRelease() {
    const status = document.getElementById("release-status");
    try {
      const response = await fetch(releasesUrl, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error("No hay una publicación estable disponible todavía.");
      const release = await response.json();
      const published = release.published_at ? new Date(release.published_at).toLocaleDateString("es-CL") : "";
      status.textContent = (release.name || release.tag_name || "Última versión") + (published ? " · Publicada " + published : "");
      for (const platform of Object.keys(targets)) {
        const asset = (release.assets || []).find(item => targets[platform].match.test(item.name));
        if (asset) setDownload(platform, asset, release);
        else setStatus(platform, "Esta versión aún no incluye un instalador de " + targets[platform].label + ".");
      }
    } catch (error) {
      status.textContent = "Aún no hay una versión descargable publicada.";
      for (const platform of Object.keys(targets)) setStatus(platform, "Próximamente: el paquete oficial todavía no está publicado.");
    }
  }
  const menu = document.getElementById("menu");
  if (menu) menu.addEventListener("click", () => document.getElementById("nav")?.classList.toggle("open"));
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  loadRelease();
})();
