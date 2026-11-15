-- Rebuild the FK while converting UUID IDs to text for D1 identity compatibility.
ALTER TABLE joynexa.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE joynexa.users ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES joynexa.users(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
