import { normalizeWord } from "./letters";

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
// Awarded per run, shown on leaderboards and on the player's own found words.
// They signal achievement without revealing words the player did not find.

export interface Badges {
  /** Found seed word A (the first seed). */
  sun: boolean;
  /** Found seed word B (the second seed). */
  moon: boolean;
  /** Found a non-seed word at least as long as the shorter seed. */
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
  const shorter = Math.min(a.length, b.length);

  let star: string | null = null;
  for (const word of [...found].sort()) {
    if (word === a || word === b) continue;
    if (word.length >= shorter) {
      star = word;
      break;
    }
  }

  return {
    sun: found.has(a) ? a : null,
    moon: found.has(b) ? b : null,
    star,
  };
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
  const shorter = Math.min(a.length, b.length);

  const marks: BadgeKind[] = [];
  if (w === a) marks.push("sun");
  if (w === b) marks.push("moon");
  if (w !== a && w !== b && w.length >= shorter) marks.push("star");
  return marks;
}
