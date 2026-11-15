-- Favorites use the universal Joynexa ID from the Accounts API.
-- Accounts are now stored in PostgreSQL, so do not FK this user ID to the legacy D1 users table.
CREATE TABLE IF NOT EXISTS joynexa_favorites (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_id)
);

INSERT OR IGNORE INTO joynexa_favorites (user_id, game_id, created_at)
SELECT user_id, game_id, created_at FROM favorites;

CREATE INDEX IF NOT EXISTS joynexa_favorites_user_created_idx
  ON joynexa_favorites (user_id, created_at DESC);
