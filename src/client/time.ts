/** Minutes to add to local time to reach UTC (Date.prototype.getTimezoneOffset). */
export function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

/** The viewer's local calendar date as YYYY-MM-DD. */
export function localDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
