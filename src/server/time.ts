// The game's "day" is fixed to IST (UTC+5:30); a new game arrives at 00:00 IST,
// the same for every player regardless of their local timezone.

/** The game day offset from UTC (IST = UTC+5:30). */
export const GAME_TZ_OFFSET_MINUTES = 5 * 60 + 30;

/** Calendar date (YYYY-MM-DD) of the game day for `now`. */
export function gameDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + GAME_TZ_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}
