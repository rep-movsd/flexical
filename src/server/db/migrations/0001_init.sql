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

-- One game per calendar date. `date` is a "YYYY-MM-DD" UTC-local mix chosen by
-- the viewer's timezone; `id` is the same string.
CREATE TABLE IF NOT EXISTS games (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL UNIQUE,
  seed_a              TEXT NOT NULL,
  seed_b              TEXT NOT NULL,
  letters             TEXT NOT NULL,   -- sorted distinct allowed letters, e.g. "AEIMNORSTU"
  longest_seed_length INTEGER NOT NULL,
  shortest_seed_length INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);

-- One row per (player, game): the player's best run. words_json is a timeline:
-- [{"word":"stone","t":1234}]. For today's game only the first submission is kept.
CREATE TABLE IF NOT EXISTS plays (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  words_json  TEXT NOT NULL,
  score       INTEGER NOT NULL,
  words_found INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_plays_game_score ON plays(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_plays_user ON plays(user_id);

-- Records that a player looked at another player's words for a game, which
-- permanently locks that game for them.
CREATE TABLE IF NOT EXISTS reveals (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  revealed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);
