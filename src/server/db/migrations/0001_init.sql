-- Wordtwist schema. Idempotent so it can be re-run safely.
-- Apply locally:  npm run db:migrate:local
-- Apply remotely: npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  salt           TEXT NOT NULL,
  hash           TEXT NOT NULL,
  iterations     INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
  -- Future auth migration path: add nullable provider/provider_id columns and a
  -- unique index on (provider, provider_id) to link OAuth identities later.
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS puzzles (
  id            TEXT PRIMARY KEY,
  rack          TEXT NOT NULL,
  solution_json TEXT NOT NULL,
  max_score     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  league_id     TEXT
);

CREATE TABLE IF NOT EXISTS plays (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id   TEXT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  words_json  TEXT NOT NULL,
  score       INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  UNIQUE (user_id, puzzle_id)
);
CREATE INDEX IF NOT EXISTS idx_plays_puzzle_score ON plays(puzzle_id, score DESC);

CREATE TABLE IF NOT EXISTS leagues (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (league_id, user_id)
);
