CREATE TABLE IF NOT EXISTS joynexa.profiles (
  user_id UUID PRIMARY KEY REFERENCES joynexa.users(id) ON DELETE CASCADE,
  display_name VARCHAR(32) NOT NULL,
  bio VARCHAR(160) NOT NULL DEFAULT '',
  avatar_key VARCHAR(20) NOT NULL DEFAULT 'star'
    CHECK (avatar_key IN ('star','planet','comet','controller','pixel','fox','robot','gem')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO joynexa.profiles (user_id, display_name)
SELECT id, username FROM joynexa.users
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS profiles_public_username_lookup
  ON joynexa.profiles (is_public, user_id);
