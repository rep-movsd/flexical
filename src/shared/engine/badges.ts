import { normalizeWord } from "./letters";

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
// Awarded per run, shown on leaderboards and on the player's own found words.
// They signal achievement without revealing words the player did not find.
//
// NOTE: games currently use a single seed word, so the 🌙 "moon" badge (the
// second seed) is disabled. The moon code is kept (commented) so it is easy to
// re-enable if we go back to a pair of seeds.

export interface Badges {
  /** Found seed word A (the first/only seed). */
  sun: boolean;
  /** Found seed word B (the second seed). Disabled while games have one seed. */
  moon: boolean;
  /** Found a non-seed word at least as long as the (shorter) seed. */
  star: boolean;
}

export type BadgeKind = "sun" | "moon" | "star";

/** Which specific words (if any) earned each badge for this run. */
export interface BadgeWords {
  sun: string | null;
  moon: string | null;
  star: string | null;
}

export function computeBadgeWords(
  words: Iterable<string>,
  seedA: string,
  seedB: string,
): BadgeWords {
  const found = new Set<string>();
  for (const word of words) found.add(normalizeWord(word));

  const a = normalizeWord(seedA);
  const b = normalizeWord(seedB);
  // With one seed, the reference length is the single seed's length.
  const shorter = b.length > 0 ? Math.min(a.length, b.length) : a.length;

  // --- Moon (second seed) disabled: single-seed games. ---------------------
  // const moon = b.length > 0 && found.has(b) ? b : null;
  const moon: string | null = null;

  let star: string | null = null;
  for (const word of [...found].sort()) {
    if (word === a || word === b) continue;
    if (word.length >= shorter) {
      star = word;
      break;
    }
  }

  return { sun: found.has(a) ? a : null, moon, star };
}

export function computeBadges(
  words: Iterable<string>,
  seedA: string,
  seedB: string,
): Badges {
  const badgeWords = computeBadgeWords(words, seedA, seedB);
  return {
    sun: badgeWords.sun !== null,
    moon: badgeWords.moon !== null,
    star: badgeWords.star !== null,
  };
}

/** Badge marks for a single word (already-known to be a valid word). */
export function wordMarks(word: string, seedA: string, seedB: string): BadgeKind[] {
  const w = normalizeWord(word);
  const a = normalizeWord(seedA);
  const b = normalizeWord(seedB);
  const shorter = b.length > 0 ? Math.min(a.length, b.length) : a.length;

  const marks: BadgeKind[] = [];
  if (w === a) marks.push("sun");
  // if (b.length > 0 && w === b) marks.push("moon");   // moon disabled
  if (w !== a && w !== b && w.length >= shorter) marks.push("star");
  return marks;
}
