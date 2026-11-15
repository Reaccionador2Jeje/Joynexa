ALTER TABLE joynexa.sessions
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_idx
  ON joynexa.sessions(id);
