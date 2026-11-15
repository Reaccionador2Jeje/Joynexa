import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import pg from "pg";

const base = process.env.TEST_API_URL ?? "http://127.0.0.1:3001";
const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:8787";
const setupKey = process.env.ADMIN_SETUP_KEY ?? "";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function call(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json", origin } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  const setCookie = response.headers.get("set-cookie");
  const nextCookie = setCookie?.split(";")[0];
  return { response, data, cookie: nextCookie };
}

try {
  const health = await call("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.data.service, "joynexa-accounts");

  const username = "ci_" + randomBytes(4).toString("hex");
  const password = "Joynexa_Test_Password_123!";
  const registered = await call("/api/register", {
    method: "POST",
    body: { username, password }
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.data.user.username, username);
  assert.ok(registered.cookie, "register should set an HttpOnly session cookie");

  const duplicate = await call("/api/register", {
    method: "POST",
    body: { username, password }
  });
  assert.equal(duplicate.response.status, 409);

  const me = await call("/api/me", { cookie: registered.cookie });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.username, username);

  const badOrigin = await call("/api/logout", {
    method: "POST",
    cookie: registered.cookie,
    headers: { origin: "https://attacker.invalid" }
  });
  assert.equal(badOrigin.response.status, 403);

  const logout = await call("/api/logout", {
    method: "POST",
    body: {},
    cookie: registered.cookie
  });
  assert.equal(logout.response.status, 200);
  const afterLogout = await call("/api/me", { cookie: registered.cookie });
  assert.equal(afterLogout.data.user, null);

  const login = await call("/api/login", {
    method: "POST",
    body: { username, password }
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.cookie);

  const sessions = await call("/api/sessions", { cookie: login.cookie });
  assert.equal(sessions.response.status, 200);
  assert.equal(sessions.data.sessions.length, 2);
  const currentSession = sessions.data.sessions.find((session) => session.is_current);
  const oldSession = sessions.data.sessions.find((session) => !session.is_current);
  assert.ok(currentSession?.id, "session list should identify the current session");
  assert.ok(oldSession?.id, "session list should include the earlier registration session");
  assert.ok(currentSession.user_agent === null || typeof currentSession.user_agent === "string");

  const revokeOld = await call("/api/sessions/" + oldSession.id, {
    method: "DELETE",
    cookie: login.cookie,
    headers: { origin }
  });
  assert.equal(revokeOld.response.status, 200);
  assert.equal(revokeOld.data.revokedCurrent, false);
  const oldSessionMe = await call("/api/me", { cookie: registered.cookie });
  assert.equal(oldSessionMe.data.user, null);
  const currentSessionMe = await call("/api/me", { cookie: login.cookie });
  assert.equal(currentSessionMe.data.user.username, username);

  const setupStatus = await call("/api/admin/setup-status");
  assert.equal(setupStatus.data.setupAvailable, true);

  const bootstrap = await call("/api/admin/bootstrap", {
    method: "POST",
    body: {},
    cookie: login.cookie,
    headers: { "x-admin-setup-key": setupKey }
  });
  assert.equal(bootstrap.response.status, 200);

  const adminMe = await call("/api/me", { cookie: login.cookie });
  assert.equal(adminMe.data.user.role, "admin");

  const setupUsed = await call("/api/admin/setup-status");
  assert.equal(setupUsed.data.setupAvailable, false);

  // Seed one account using the exact legacy D1 PBKDF2 parameters.
  const legacyUsername = "legacy_" + randomBytes(4).toString("hex");
  const legacyPassword = "Legacy_Password_123!";
  const legacyId = randomBytes(16).toString("hex");
  const salt = randomBytes(16);
  const saltHex = salt.toString("hex");
  const legacyHash = pbkdf2Sync(legacyPassword, salt, 210_000, 32, "sha256").toString("hex");
  await pool.query(
    "INSERT INTO users (id, username, password_hash, password_salt) VALUES ($1, $2, $3, $4)",
    [legacyId, legacyUsername, legacyHash, saltHex]
  );

  const legacyLogin = await call("/api/login", {
    method: "POST",
    body: { username: legacyUsername, password: legacyPassword }
  });
  assert.equal(legacyLogin.response.status, 200);
  const upgraded = await pool.query(
    "SELECT password_hash, password_salt FROM users WHERE id = $1",
    [legacyId]
  );
  assert.match(upgraded.rows[0].password_hash, /^\$argon2id\$/);
  assert.equal(upgraded.rows[0].password_salt, null);

  const finalSessions = await call("/api/sessions", { cookie: login.cookie });
  const activeSession = finalSessions.data.sessions.find((session) => session.is_current);
  const revokeCurrent = await call("/api/sessions/" + activeSession.id, {
    method: "DELETE", cookie: login.cookie, headers: { origin }
  });
  assert.equal(revokeCurrent.response.status, 200);
  assert.equal(revokeCurrent.data.revokedCurrent, true);
  const revokedMe = await call("/api/me", { cookie: login.cookie });
  assert.equal(revokedMe.data.user, null);

  console.log("Accounts API integration checks passed.");
} finally {
  await pool.end();
}
