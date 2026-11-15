-- Embedded play sessions and capped playtime XP.
ALTER TABLE games ADD COLUMN embed_url TEXT;
ALTER TABLE games ADD COLUMN embed_enabled INTEGER NOT NULL DEFAULT 0 CHECK (embed_enabled IN (0,1));
UPDATE games SET embed_url=launch_url,embed_enabled=1 WHERE slug IN ('3d-city','minilens','1255-burgomaster');
CREATE TABLE IF NOT EXISTS joynexa_play_sessions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 started_at INTEGER NOT NULL,
 last_ping_at INTEGER NOT NULL,
 ended_at INTEGER,
 earned_xp INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS joynexa_play_sessions_user_idx ON joynexa_play_sessions(user_id,started_at DESC);
CREATE TABLE IF NOT EXISTS joynexa_xp_ledger (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES joynexa_play_sessions(id) ON DELETE CASCADE,
 xp INTEGER NOT NULL CHECK (xp BETWEEN 1 AND 1),
 reason TEXT NOT NULL,
 day_key INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS joynexa_xp_user_day_idx ON joynexa_xp_ledger(user_id,day_key);
