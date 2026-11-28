-- Joynexa DevGit: GitHub OAuth connections and one-time OAuth state.
CREATE TABLE IF NOT EXISTS joynexa_github_connections (
  user_id TEXT PRIMARY KEY,
  github_login TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_cipher TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS joynexa_github_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_joynexa_github_oauth_expiry
  ON joynexa_github_oauth_states(expires_at);
