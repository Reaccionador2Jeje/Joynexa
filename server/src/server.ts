import "dotenv/config";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import argon2 from "argon2";
import { createHash, randomBytes, randomUUID, pbkdf2 as pbkdf2Callback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { z } from "zod";

const { Pool } = pg;
const pbkdf2 = promisify(pbkdf2Callback);
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN ?? "http://localhost:8787")
  .split(",").map((value) => value.trim()).filter(Boolean);
const SESSION_TTL_SECONDS = Math.min(
  Math.max(Number(process.env.SESSION_TTL_SECONDS ?? 1_209_600), 300),
  2_592_000
);
const COOKIE_NAME = "jn_session";
const isProduction = NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;
const adminSetupKey = process.env.ADMIN_SETUP_KEY ?? "";

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (FRONTEND_ORIGINS.length === 0) throw new Error("FRONTEND_ORIGIN must contain at least one allowed origin");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000
});

const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 16 * 1024
});

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(10).max(128)
});

type PublicUser = { id: string; username: string; role: string };
type StoredUser = PublicUser & { password_hash: string; password_salt: string | null };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function requestUserAgent(request: FastifyRequest): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value.slice(0, 300) : null;
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/"
  });
}

async function findUserFromSession(request: FastifyRequest): Promise<PublicUser | null> {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return null;

  const result = await pool.query<PublicUser>(
    `SELECT u.id, u.username, u.role
       FROM joynexa.sessions s
       JOIN joynexa.users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}

async function verifyPassword(user: StoredUser, password: string): Promise<boolean> {
  if (user.password_hash.startsWith("$argon2id$")) {
    return argon2.verify(user.password_hash, password);
  }

  // Legacy D1 hashes use PBKDF2-SHA256, 210,000 iterations, 256 bits.
  if (!user.password_salt || !/^[a-f0-9]{32}$/i.test(user.password_salt) ||
      !/^[a-f0-9]{64}$/i.test(user.password_hash)) return false;

  const candidate = await pbkdf2(
    password,
    Buffer.from(user.password_salt, "hex"),
    210_000,
    32,
    "sha256"
  );
  const expected = Buffer.from(user.password_hash, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return false;

  // Upgrade the password hash after a successful legacy login.
  const upgraded = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
  await pool.query(
    "UPDATE joynexa.users SET password_hash = $1, password_salt = NULL WHERE id = $2 AND password_hash = $3",
    [upgraded, user.id, user.password_hash]
  );
  return true;
}

async function requireSameOrigin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
  const origin = request.headers.origin;
  // Browser session mutations must carry an explicit allowed Origin. Rejecting
  // a missing Origin closes the gap left by checking only mismatched headers.
  if (!origin || !FRONTEND_ORIGINS.includes(origin)) {
    reply.code(403).send({ error: "Origen no permitido." });
    return;
  }
}

async function verifySetupKey(provided: string): Promise<boolean> {
  if (adminSetupKey.length < 32 || provided.length === 0) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(adminSetupKey).digest();
  return timingSafeEqual(a, b);
}

app.register(helmet, { contentSecurityPolicy: false });
app.register(cookie);
app.register(cors, {
  origin: FRONTEND_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-admin-setup-key"]
});
app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute"
});
app.addHook("preHandler", requireSameOrigin);
app.addHook("onSend", async (request, reply, payload) => {
  if (request.url.startsWith("/api/")) reply.header("cache-control", "no-store");
  return payload;
});

app.get("/health", async (_request, reply) => {
  await pool.query("SELECT 1");
  return reply.send({ ok: true, service: "joynexa-accounts", version: "0.2.0" });
});

app.post("/api/register", {
  config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
}, async (request, reply) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "El usuario debe tener 3-20 caracteres y la contraseña entre 10 y 128."
    });
  }

  const username = parsed.data.username;
  const passwordHash = await argon2.hash(parsed.data.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
  const id = randomUUID();
  const token = newSessionToken();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const created = await client.query<PublicUser>(
      `INSERT INTO joynexa.users (id, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [id, username, passwordHash]
    );
    await client.query(
      "INSERT INTO joynexa.sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'), $4)",
      [hashToken(token), id, SESSION_TTL_SECONDS, requestUserAgent(request)]
    );
    await client.query("INSERT INTO joynexa.profiles (user_id, display_name) VALUES ($1, $2)", [id, username]);
    await client.query("COMMIT");
    setSessionCookie(reply, token);
    return reply.code(201).send({ user: created.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      return reply.code(409).send({ error: "Ese nombre de usuario ya está ocupado." });
    }
    throw error;
  } finally {
    client.release();
  }
});

app.post("/api/login", {
  config: { rateLimit: { max: 8, timeWindow: "15 minutes" } }
}, async (request, reply) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Usuario o contraseña incorrectos." });
  }

  const result = await pool.query<StoredUser>(
    `SELECT id, username, role, password_hash, password_salt
       FROM joynexa.users
      WHERE LOWER(username) = LOWER($1) AND status = 'active'
      LIMIT 1`,
    [parsed.data.username]
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(user, parsed.data.password))) {
    return reply.code(401).send({ error: "Usuario o contraseña incorrectos." });
  }

  const token = newSessionToken();
  await pool.query(
    "INSERT INTO joynexa.sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'), $4)",
    [hashToken(token), user.id, SESSION_TTL_SECONDS, requestUserAgent(request)]
  );
  setSessionCookie(reply, token);
  return reply.send({
    user: { id: user.id, username: user.username, role: user.role }
  });
});

app.post("/api/logout", async (request, reply) => {
  const token = request.cookies[COOKIE_NAME];
  if (token) {
    await pool.query("DELETE FROM joynexa.sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  clearSessionCookie(reply);
  return reply.send({ ok: true });
});

app.get("/api/me", async (request, reply) => {
  const user = await findUserFromSession(request);
  return reply.send({ user });
});

app.get("/api/sessions", async (request, reply) => {
  const user = await findUserFromSession(request);
  if (!user) return reply.code(401).send({ error: "Inicia sesión para consultar tus sesiones." });
  const token = request.cookies[COOKIE_NAME];
  const result = await pool.query(
    "SELECT id::text AS id, created_at, expires_at, user_agent, token_hash = $1 AS is_current FROM joynexa.sessions WHERE user_id = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 25",
    [hashToken(token!), user.id]
  );
  return reply.send({ sessions: result.rows });
});

app.delete("/api/sessions/:id", async (request, reply) => {
  const user = await findUserFromSession(request);
  if (!user) return reply.code(401).send({ error: "Inicia sesión para administrar tus sesiones." });
  const parsed = z.string().uuid().safeParse((request.params as { id?: string }).id);
  if (!parsed.success) return reply.code(400).send({ error: "Identificador de sesión no válido." });
  const token = request.cookies[COOKIE_NAME];
  const currentHash = token ? hashToken(token) : null;
  const result = await pool.query("DELETE FROM joynexa.sessions WHERE id = $1 AND user_id = $2 RETURNING token_hash", [parsed.data, user.id]);
  if (!result.rowCount) return reply.code(404).send({ error: "La sesión ya no existe o no pertenece a tu cuenta." });
  const revokedCurrent = result.rows[0].token_hash === currentHash;
  if (revokedCurrent) clearSessionCookie(reply);
  return reply.send({ ok: true, revokedCurrent });
});


const containsContactDetails = (value: string) =>
  !/(https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,})/i.test(value);

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(32).refine(containsContactDetails, "No incluyas enlaces ni datos de contacto."),
  bio: z.string().trim().max(160).refine(containsContactDetails, "No incluyas enlaces ni datos de contacto."),
  avatarKey: z.enum(["star", "planet", "comet", "controller", "pixel", "fox", "robot", "gem"]),
  isPublic: z.boolean()
});

async function ensureProfile(user: PublicUser) {
  await pool.query(
    "INSERT INTO joynexa.profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
    [user.id, user.username]
  );
}

function profilePayload(row: any, includePrivacy = false) {
  return {
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarKey: row.avatar_key,
    ...(includePrivacy ? { isPublic: row.is_public } : {})
  };
}

app.get("/api/profile/me", async (request, reply) => {
  const user = await findUserFromSession(request);
  if (!user) return reply.code(401).send({ error: "Inicia sesión para editar tu perfil." });
  await ensureProfile(user);
  const result = await pool.query(
    `SELECT u.username, p.display_name, p.bio, p.avatar_key, p.is_public, p.created_at
       FROM joynexa.profiles p
       JOIN joynexa.users u ON u.id = p.user_id
      WHERE p.user_id = $1 LIMIT 1`,
    [user.id]
  );
  return reply.send({ profile: profilePayload(result.rows[0], true) });
});

app.put("/api/profile/me", async (request, reply) => {
  const user = await findUserFromSession(request);
  if (!user) return reply.code(401).send({ error: "Inicia sesión para editar tu perfil." });
  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Revisa el nombre visible, la biografía y el avatar." });
  await ensureProfile(user);
  const value = parsed.data;
  const result = await pool.query(
    `UPDATE joynexa.profiles
        SET display_name = $1, bio = $2, avatar_key = $3, is_public = $4, updated_at = NOW()
      WHERE user_id = $5
      RETURNING display_name, bio, avatar_key, is_public, created_at`,
    [value.displayName, value.bio, value.avatarKey, value.isPublic, user.id]
  );
  return reply.send({
    ok: true,
    profile: {
      username: user.username,
      displayName: result.rows[0].display_name,
      bio: result.rows[0].bio,
      avatarKey: result.rows[0].avatar_key,
      isPublic: result.rows[0].is_public,
    }
  });
});

app.get("/api/users/:username/profile", async (request, reply) => {
  const parsed = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/)
    .safeParse((request.params as { username?: string }).username);
  if (!parsed.success) return reply.code(404).send({ error: "No se encontró ese perfil." });
  const result = await pool.query(
    `SELECT u.username, p.display_name, p.bio, p.avatar_key, p.is_public, p.created_at
       FROM joynexa.users u
       JOIN joynexa.profiles p ON p.user_id = u.id
      WHERE LOWER(u.username) = LOWER($1) AND u.status = 'active' AND p.is_public = TRUE
      LIMIT 1`,
    [parsed.data]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Este perfil no existe o es privado." });
  return reply.send({ profile: profilePayload(result.rows[0]) });
});

app.get("/api/admin/setup-status", async (_request, reply) => {
  const result = await pool.query<{ total: string }>(
    "SELECT COUNT(*)::text AS total FROM joynexa.users WHERE role = 'admin' AND status = 'active'"
  );
  return reply.send({
    setupAvailable: Number(result.rows[0]?.total ?? 0) === 0 && adminSetupKey.length >= 32
  });
});

app.post("/api/admin/bootstrap", {
  config: { rateLimit: { max: 3, timeWindow: "15 minutes" } }
}, async (request, reply) => {
  const user = await findUserFromSession(request);
  if (!user) return reply.code(401).send({ error: "Inicia sesión primero." });
  if (adminSetupKey.length < 32) {
    return reply.code(503).send({ error: "La clave de configuración no está configurada en el backend." });
  }
  const supplied = request.headers["x-admin-setup-key"];
  if (typeof supplied !== "string" || !(await verifySetupKey(supplied))) {
    return reply.code(403).send({ error: "Clave de configuración incorrecta." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(74190211)");
    const admins = await client.query(
      "SELECT id FROM joynexa.users WHERE role = 'admin' AND status = 'active' LIMIT 1"
    );
    if (admins.rowCount) {
      await client.query("ROLLBACK");
      return reply.code(409).send({ error: "La configuración inicial ya fue utilizada." });
    }
    const result = await client.query(
      "UPDATE joynexa.users SET role = 'admin' WHERE id = $1 AND role = 'player' AND status = 'active'",
      [user.id]
    );
    if (result.rowCount !== 1) {
      await client.query("ROLLBACK");
      return reply.code(409).send({ error: "La cuenta no puede recibir el rol de administrador." });
    }
    await client.query("COMMIT");
    return reply.send({ ok: true, message: "Administrador inicial configurado." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error, path: request.url }, "Joynexa Accounts API request failed");
  if (reply.sent) return;
  return reply.code(500).send({
    error: "Error interno del servicio.",
    requestId: randomUUID()
  });
});

app.addHook("onClose", async () => {
  await pool.end();
});

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
