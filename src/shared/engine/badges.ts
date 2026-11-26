import { normalizeWord } from "./letters";

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
// Awarded per run, shown on leaderboards. They signal achievement without
// revealing any words.

export interface Badges {
  /** Found seed word A (the first seed). */
  sun: boolean;
  /** Found seed word B (the second seed). */
  moon: boolean;
  /** Found a non-seed word at least as long as the shorter seed. */
  star: boolean;
}

export function computeBadges(
  words: Iterable<string>,
  seedA: string,
  seedB: string,
): Badges {
  const found = new Set<string>();
  for (const word of words) found.add(normalizeWord(word));

  const a = normalizeWord(seedA);
  const b = normalizeWord(seedB);
  const shorter = Math.min(a.length, b.length);

  let star = false;
  for (const word of found) {
    if (word === a || word === b) continue;
    if (word.length >= shorter) {
      star = true;
      break;
    }
  }

  return { sun: found.has(a), moon: found.has(b), star };
}
