// Server-side game configuration.

/**
 * Earliest selectable game date. Games exist for any date (the seed is a hash of
 * the date), so this just bounds the archive's date picker and rejects requests
 * outside the range.
 */
export const MIN_GAME_DATE = "2026-01-01";

/**
 * Whether peeking at another player's answers permanently locks that game for
 * the viewer. Disabled while testing; enable it (starting from a fresh database)
 * before going public.
 */
export const REVEAL_LOCKS = false;
