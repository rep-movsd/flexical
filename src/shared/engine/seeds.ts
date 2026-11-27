import type { Dictionary } from "./dictionary";

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------
// Each day's game is built from a single seed word of SEED_MIN_LENGTH..
// SEED_MAX_LENGTH letters (currently 8–10). The word is chosen deterministically
// from the date string, so every player on a given date gets the same game and
// it can be regenerated from the date alone.
//
// (Historically a game used a *pair* of seeds; `pickSeed` picks one. The
// two-seed variant is kept in git history if we want it back.)

export const SEED_MIN_LENGTH = 8;
export const SEED_MAX_LENGTH = 10;

/** FNV-1a string hash → 32-bit seed. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small, fast, deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const candidateCache = new WeakMap<Dictionary, string[]>();

/** All candidate seed words (SEED_MIN_LENGTH..SEED_MAX_LENGTH), sorted (cached per Dictionary). */
export function seedCandidates(dict: Dictionary): string[] {
  const cached = candidateCache.get(dict);
  if (cached) return cached;

  const candidates: string[] = [];
  for (const word of dict.words()) {
    if (word.length >= SEED_MIN_LENGTH && word.length <= SEED_MAX_LENGTH) {
      candidates.push(word);
    }
  }
  candidates.sort();
  candidateCache.set(dict, candidates);
  return candidates;
}

/**
 * Pick the seed word for `dateKey`. `avoid` holds seeds already used recently;
 * the search retries to steer clear of them.
 */
export function pickSeed(
  dateKey: string,
  dict: Dictionary,
  avoid: ReadonlySet<string> = new Set(),
): string {
  const candidates = seedCandidates(dict);
  if (candidates.length === 0) {
    throw new Error("Dictionary has too few seed words for a game.");
  }

  const rand = mulberry32(hashString(dateKey));
  for (let attempt = 0; attempt < 200; attempt++) {
    const word = candidates[Math.floor(rand() * candidates.length)];
    if (avoid.has(word)) continue;
    return word;
  }

  // Deterministic fallback if everything recent collided.
  return candidates[0];
}
