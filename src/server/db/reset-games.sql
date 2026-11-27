-- Clear game data (games, plays, reveals) while preserving accounts and sessions.
-- Used when the game day switches to IST and the schema gains hare fields.
DELETE FROM plays;
DELETE FROM games;
DELETE FROM reveals;
