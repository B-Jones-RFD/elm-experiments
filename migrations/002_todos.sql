CREATE TABLE todo (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 4 AND 100),
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX todo_user_created ON todo(user_id, created_at);
