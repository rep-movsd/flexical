import type { Dictionary } from "./dictionary";
import { isBuildable, normalizeWord, type LetterSet } from "./letters";
import { MIN_WORD_LENGTH, pointsForLength } from "./scoring";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
// Server-side classification of a submitted word list. The client validates
// locally for feedback, but this is what produces the authoritative score.

export type RejectReason = "too_short" | "duplicate" | "not_in_rack" | "unknown";

export interface WordInput {
  word: string;
  /** Milliseconds since the attempt started. Advisory; used for ghosts. */
  t?: number;
}

export interface ClassifyResult {
  accepted: string[];
  rejected: { word: string; reason: RejectReason }[];
  score: number;
}

export function classifyWords(
  submitted: WordInput[],
  allowed: LetterSet,
  dict: Dictionary,
  k: number,
): ClassifyResult {
  const seen = new Set<string>();
  const accepted: string[] = [];
  const rejected: ClassifyResult["rejected"] = [];
  let score = 0;

  for (const entry of submitted) {
    const word = normalizeWord(entry?.word ?? "");
    if (!word) continue;

    if (word.length < MIN_WORD_LENGTH) {
      rejected.push({ word, reason: "too_short" });
    } else if (seen.has(word)) {
      rejected.push({ word, reason: "duplicate" });
    } else if (!isBuildable(word, allowed)) {
      rejected.push({ word, reason: "not_in_rack" });
    } else if (!dict.has(word)) {
      rejected.push({ word, reason: "unknown" });
    } else {
      seen.add(word);
      accepted.push(word);
      score += pointsForLength(word.length, k);
    }
  }

  return { accepted, rejected, score };
}
