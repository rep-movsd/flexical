-- Hare (timed) score fields on plays.
--   hare_count  : the first N words of words_json were found during the timed
--                 window (hare); the rest are untimed (tortoise).
--   hare_score  : points of those first N words (denormalized for the board).
--   hare_played : whether the player used the one timed attempt for this game.
ALTER TABLE plays ADD COLUMN hare_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plays ADD COLUMN hare_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plays ADD COLUMN hare_played INTEGER NOT NULL DEFAULT 0;
