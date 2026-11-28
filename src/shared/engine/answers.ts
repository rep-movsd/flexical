import type { Dictionary } from "./dictionary";
import { isBuildable, type LetterSet } from "./letters";

// ---------------------------------------------------------------------------
// Answer counts
// ---------------------------------------------------------------------------
// How many dictionary words can be built from the allowed letters, broken down
// by word length. Computed once per game (it is a property of the rack) so the
// server never has to re-scan the dictionary on every request.

export interface AnswerCount {
  length: number;
  count: number;
}

/**
 * Count buildable dictionary words of each length (>= `minLength`). Lengths with
 * zero words are omitted; the result is sorted ascending by length.
 */
export function countAnswersByLength(
  allowed: LetterSet,
  dict: Dictionary,
  minLength: number,
): AnswerCount[] {
  const counts = new Map<number, number>();
  for (const word of dict.words()) {
    if (word.length < minLength) continue;
    if (!isBuildable(word, allowed)) continue;
    counts.set(word.length, (counts.get(word.length) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([length, count]) => ({ length, count }))
    .sort((a, b) => a.length - b.length);
}

/** Sum of all per-length counts. */
export function totalAnswers(counts: AnswerCount[]): number {
  return counts.reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * Every buildable dictionary word of length >= `minLength`, in the dictionary's
 * (alphabetical) order. Used to reveal the answers for a game.
 */
export function listAnswers(allowed: LetterSet, dict: Dictionary, minLength: number): string[] {
  const out: string[] = [];
  for (const word of dict.words()) {
    if (word.length < minLength) continue;
    if (!isBuildable(word, allowed)) continue;
    out.push(word);
  }
  return out;
}
