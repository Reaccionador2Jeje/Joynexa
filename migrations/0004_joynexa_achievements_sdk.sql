-- Joynexa Achievements and server-to-server Game SDK.
-- Account IDs come from the Accounts API, so user_id/owner_id are plain TEXT.
CREATE TABLE IF NOT EXISTS joynexa_game_keys (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS joynexa_game_keys_game_idx
  ON joynexa_game_keys(game_id, revoked_at);

CREATE TABLE IF NOT EXISTS joynexa_achievement_defs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 10 CHECK(points BETWEEN 0 AND 1000),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, code)
);
CREATE INDEX IF NOT EXISTS joynexa_achievement_defs_game_idx
  ON joynexa_achievement_defs(game_id);

CREATE TABLE IF NOT EXISTS joynexa_user_achievements (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES joynexa_achievement_defs(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS joynexa_user_achievements_user_idx
  ON joynexa_user_achievements(user_id, earned_at DESC);
