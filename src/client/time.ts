// The game's "day" is fixed to IST (UTC+5:30), matching the server.

const GAME_TZ_OFFSET_MINUTES = 5 * 60 + 30;

/** The game day (YYYY-MM-DD) for `now`, in IST. */
export function gameDateString(now = new Date()): string {
  const shifted = new Date(now.getTime() + GAME_TZ_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}
