import test from "node:test";
import assert from "node:assert/strict";
import { JoynexaGameClient, JoynexaGameError } from "../index.js";

const key = "jn_game_" + "a".repeat(64);
const userId = "b".repeat(32);

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

test("requires HTTPS outside localhost", () => {
  assert.throws(() => new JoynexaGameClient({
    baseUrl: "http://example.com",
    gameSlug: "demo",
    apiKey: key
  }), /HTTPS/);
});

test("rejects base URLs that contain paths", () => {
  assert.throws(() => new JoynexaGameClient({
    baseUrl: "https://joynexa.example/api",
    gameSlug: "demo",
    apiKey: key
  }), /solo el origen/);
});

test("awards through the server endpoint with the private key", async () => {
  let request;
  const client = new JoynexaGameClient({
    baseUrl: "https://joynexa.example",
    gameSlug: "demo-game",
    apiKey: key,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ ok: true, awarded: true, duplicate: false });
    }
  });

  const result = await client.awardAchievement({ userId, code: "first_win" });
  assert.deepEqual(result, { awarded: true, duplicate: false });
  assert.equal(request.url, "https://joynexa.example/api/sdk/games/demo-game/achievements/first_win");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.authorization, "Bearer " + key);
  assert.deepEqual(JSON.parse(request.options.body), { userId });
  assert.equal(request.options.redirect, "error");
});

test("rejects invalid player IDs before making a request", async () => {
  let called = false;
  const client = new JoynexaGameClient({
    baseUrl: "https://joynexa.example",
    gameSlug: "demo",
    apiKey: key,
    fetchImpl: async () => { called = true; return response({}); }
  });

  await assert.rejects(
    client.awardAchievement({ userId: "not-an-id", code: "first_win" }),
    TypeError
  );
  assert.equal(called, false);
});

test("surfaces API errors without returning the private key", async () => {
  const client = new JoynexaGameClient({
    baseUrl: "https://joynexa.example",
    gameSlug: "demo",
    apiKey: key,
    fetchImpl: async () => response({ error: "Credencial revocada." }, 401)
  });

  await assert.rejects(
    client.awardAchievement({ userId, code: "first_win" }),
    error => error instanceof JoynexaGameError &&
      error.status === 401 &&
      error.message === "Credencial revocada." &&
      !error.message.includes(key)
  );
});
