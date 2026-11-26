// The game's "day" follows the viewer's local timezone. The client sends its
// UTC offset (minutes, as returned by Date.prototype.getTimezoneOffset()) and
// we turn that into a calendar date.

/** Maximum absolute offset we accept (minutes). */
const MAX_OFFSET_MINUTES = 14 * 60;

/** Clamp an X-TZ-Offset header to a sane range; default UTC. */
export function parseOffset(header: string | undefined): number {
  const value = Number(header);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Math.trunc(value)));
}

/** Calendar date (YYYY-MM-DD) in the timezone `offsetMinutes` behind/ahead of UTC. */
export function localDate(offsetMinutes: number, now = new Date()): string {
  // getTimezoneOffset() is minutes to *add* local time to reach UTC, so local
  // time = utc - offset.
  const localMs = now.getTime() - offsetMinutes * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}
