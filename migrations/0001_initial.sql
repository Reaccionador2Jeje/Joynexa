PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS games (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'other',
 launch_url TEXT, thumbnail_url TEXT, developer_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS games_status_created_idx ON games(status, created_at DESC);
CREATE TABLE IF NOT EXISTS achievements (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 code TEXT NOT NULL, title TEXT NOT NULL, earned_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(user_id, game_id, code)
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(user_id, game_id)
);
CREATE TABLE IF NOT EXISTS moderation_events (
 id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK (action IN ('submitted','approved','rejected')),
 note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
