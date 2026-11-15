-- Keep IDs compatible with the existing D1 identity values.
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
