CREATE SCHEMA IF NOT EXISTS joynexa;

CREATE TABLE IF NOT EXISTS joynexa.users (
  id TEXT PRIMARY KEY,
  username VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT,
  role VARCHAR(16) NOT NULL DEFAULT 'player'
    CHECK (role IN ('player', 'admin', 'developer', 'moderator')),
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx
  ON joynexa.users (LOWER(username));

CREATE TABLE IF NOT EXISTS joynexa.sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES joynexa.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON joynexa.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON joynexa.sessions(expires_at);
