// ---------------------------------------------------------------------------
// Letters
// ---------------------------------------------------------------------------
// The puzzle is a *set* of allowed letters (the distinct letters of the seed
// word). Letters may be reused any number of times, so a word is valid iff
// every letter it contains is in the set — no counting, no consumption.

export type LetterSet = Set<string>;

/** Distinct uppercase letters appearing in the seed word, sorted A–Z. */
export function allowedLetters(seed: string): string[] {
  const set = new Set<string>();
  for (const ch of seed.toUpperCase()) {
    if (ch >= "A" && ch <= "Z") set.add(ch);
  }
  return [...set].sort();
}

export function toLetterSet(letters: Iterable<string>): LetterSet {
  const set = new Set<string>();
  for (const letter of letters) set.add(letter.toUpperCase());
  return set;
}

/** Trim + lowercase, as used everywhere words are stored or compared. */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

/** True if every letter of `word` is allowed (letters may repeat freely). */
export function isBuildable(word: string, allowed: LetterSet): boolean {
  for (const ch of word.toUpperCase()) {
    if (!allowed.has(ch)) return false;
  }
  return true;
}
