// ---------------------------------------------------------------------------
// Rack
// ---------------------------------------------------------------------------
// A "rack" is the multiset of letters a player works with for one puzzle. Every
// word must be buildable from the rack: each letter may be used at most once
// per word, but the rack itself is NOT consumed between words (it is reusable
// across the whole puzzle).

export interface Rack {
  /** Exactly RACK_SIZE letters, uppercase, e.g. ["A","E","E","I","P","R","S"]. */
  letters: string[];
}

/** Number of tiles on a rack (standard Scrabble rack). */
export const RACK_SIZE = 7;

/**
 * English Scrabble tile distribution as a flat string. Each character appears
 * as many times as its tile count. Feel free to swap this for a rendering that
 * weights by language or difficulty.
 */
export const LETTER_BAG =
  "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSSSTTTTTTUUUUVVWWXYYZ";

/**
 * TODO(game logic): Choose a fresh rack for a new puzzle.
 *
 * WHAT IT SHOULD DO
 *   - Draw RACK_SIZE tiles, e.g. by sampling from LETTER_BAG (weighted by tile
 *     frequency) or from a custom distribution you tune for fun/fairness.
 *   - Return the letters uppercase, in any order.
 *   - (Recommended) Guarantee playability: keep redrawing until solveRack on
 *     the candidate yields at least N words. A rack with no words is a dud.
 *   - (Optional) Avoid racks with a huge number of long words, which make
 *     "find them all" tedious.
 *
 * DESIGN NOTES
 *   - `rand` is injectable so tests are deterministic: pass a seeded PRNG and
 *     assert exact output. Do not call Math.random directly inside tests.
 *   - Because the Worker owns rack generation AND solving, the client never
 *     needs the dictionary — which also makes the puzzle harder to cheat.
 *
 * This placeholder returns a uniformly random draw from LETTER_BAG. Replace it.
 */
export function generateRack(rand: () => number = Math.random): Rack {
  const letters: string[] = [];
  for (let i = 0; i < RACK_SIZE; i++) {
    letters.push(LETTER_BAG[Math.floor(rand() * LETTER_BAG.length)]);
  }
  return { letters };
}

/**
 * Convenience: is `word` spelling-buildable from `rack` (each letter used at
 * most once)? Pure, no dictionary involved. This is a small helper you may or
 * may not want inside solveRack — kept here so both solver and server-side
 * validation can share it.
 *
 * Examples:
 *   canBuild("SEE", ["A","E","E","I","P","R","S"]) === true
 *   canBuild("SEEP", ["A","E","E","I","P","R","S"]) === true (two E's)
 *   canBuild("SAFE", ["A","E","E","I","P","R","S"]) === false (no F)
 *
 * NOTE: This implementation is intentionally left as an exercise, because how
 * you normalise case and handle non-letters is a design choice. A reasonable
 * version:
 *   1. Count available letters in the rack (Map<string, number>).
 *   2. Walk the word, decrementing counts; fail if a letter runs out.
 */
export function canBuild(word: string, rack: Rack): boolean {
  const available = new Map<string, number>();
  for (const letter of rack.letters) {
    const key = letter.toUpperCase();
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  for (const ch of word.toUpperCase()) {
    const remaining = available.get(ch) ?? 0;
    if (remaining <= 0) return false;
    available.set(ch, remaining - 1);
  }
  return true;
}
