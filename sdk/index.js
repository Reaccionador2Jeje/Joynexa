const SLUG_RE = /^[a-z0-9-]{1,80}$/i;
const USER_ID_RE = /^[a-f0-9]{32}$/i;
const CODE_RE = /^[a-z0-9_-]{2,40}$/;
const KEY_RE = /^jn_game_[a-f0-9]{64}$/;

export class JoynexaGameError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "JoynexaGameError";
    this.status = status;
  }
}

function normalizeApiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl debe ser un origen HTTPS válido.");
  }

  const localHttp = url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if (url.protocol !== "https:" && !localHttp) {
    throw new TypeError("El Game SDK requiere HTTPS (HTTP solo se permite en localhost).");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new TypeError("baseUrl debe contener solo el origen, sin rutas ni credenciales.");
  }
  return url.origin;
}

export class JoynexaGameClient {
  #apiKey;

  constructor({ baseUrl, gameSlug, apiKey, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
      throw new TypeError("Falta baseUrl.");
    }
    if (typeof gameSlug !== "string" || !SLUG_RE.test(gameSlug)) {
      throw new TypeError("gameSlug no es válido.");
    }
    if (typeof apiKey !== "string" || !KEY_RE.test(apiKey)) {
      throw new TypeError("apiKey no tiene el formato de una clave privada Joynexa.");
    }
    if (typeof fetchImpl !== "function") {
      throw new TypeError("fetchImpl debe ser una función.");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
      throw new TypeError("timeoutMs debe estar entre 1000 y 30000.");
    }

    this.baseUrl = normalizeApiOrigin(baseUrl);
    this.gameSlug = gameSlug;
    this.#apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async awardAchievement({ userId, code } = {}) {
    if (typeof userId !== "string" || !USER_ID_RE.test(userId)) {
      throw new TypeError("userId debe ser un Joynexa ID de 32 caracteres hexadecimales.");
    }
    if (typeof code !== "string" || !CODE_RE.test(code)) {
      throw new TypeError("code debe tener 2-40 caracteres: letras minúsculas, números, _ o -.");
    }

    const url = this.baseUrl + "/api/sdk/games/" +
      encodeURIComponent(this.gameSlug) + "/achievements/" + encodeURIComponent(code);

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: "Bearer " + this.#apiKey,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({ userId }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (cause) {
      throw new JoynexaGameError("No se pudo conectar con Joynexa para registrar el logro.", { cause });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof payload?.error === "string"
        ? payload.error.slice(0, 200)
        : "Joynexa rechazó la solicitud de logro.";
      throw new JoynexaGameError(message, { status: response.status });
    }

    if (payload?.ok !== true ||
        typeof payload.awarded !== "boolean" ||
        typeof payload.duplicate !== "boolean") {
      throw new JoynexaGameError("Joynexa devolvió una respuesta inesperada.", { status: response.status });
    }

    return {
      awarded: payload.awarded,
      duplicate: payload.duplicate
    };
  }
}
