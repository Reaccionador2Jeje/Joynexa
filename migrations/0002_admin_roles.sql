ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'player'
CHECK (role IN ('player', 'admin'));
