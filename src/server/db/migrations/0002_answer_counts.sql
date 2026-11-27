-- Precomputed per-length answer counts for each game: JSON array of
-- [{"length":4,"count":37}, ...]. Computed once when the game is created.
ALTER TABLE games ADD COLUMN answer_counts_json TEXT NOT NULL DEFAULT '[]';
