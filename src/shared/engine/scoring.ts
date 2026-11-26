// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
// points(n) = round(n + K^n)   with   K = L^(1/L)
// where L is the length of the longer seed word. This is calibrated so the
// longer seed word scores exactly 2L (because K^L === L).

/** Shortest word that scores. Tune to taste. */
export const MIN_WORD_LENGTH = 4;

/** K for a game, derived from the longer seed length. */
export function computeK(longestSeedLength: number): number {
  if (longestSeedLength <= 0) return 1;
  return Math.pow(longestSeedLength, 1 / longestSeedLength);
}

/** Points for a word of length `n` under game constant `k`. */
export function pointsForLength(n: number, k: number): number {
  if (n < MIN_WORD_LENGTH) return 0;
  return Math.round(n + Math.pow(k, n));
}

export function scoreWords(words: Iterable<string>, k: number): number {
  let total = 0;
  for (const word of words) total += pointsForLength(word.length, k);
  return total;
}
