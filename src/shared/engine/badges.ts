import { normalizeWord } from "./letters";

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
// Awarded per run, shown on boards and on the player's own found words. They
// signal achievement without revealing words the player did not find.
//
//   ☀ sun  — the run contains the seed word.
//   ⭐ star — the run contains a non-seed word at least as long as the seed.

export interface Badges {
  /** Found the seed word. */
  sun: boolean;
  /** Found a non-seed word at least as long as the seed. */
  star: boolean;
}

export type BadgeKind = "sun" | "star";

/** Which specific words (if any) earned each badge for this run. */
export interface BadgeWords {
  sun: string | null;
  star: string | null;
}

export function computeBadgeWords(words: Iterable<string>, seed: string): BadgeWords {
  const found = new Set<string>();
  for (const word of words) found.add(normalizeWord(word));

  const s = normalizeWord(seed);

  let star: string | null = null;
  for (const word of [...found].sort()) {
    if (word === s) continue;
    if (word.length >= s.length) {
      star = word;
      break;
    }
  }

  return { sun: found.has(s) ? s : null, star };
}

export function computeBadges(words: Iterable<string>, seed: string): Badges {
  const badgeWords = computeBadgeWords(words, seed);
  return {
    sun: badgeWords.sun !== null,
    star: badgeWords.star !== null,
  };
}
