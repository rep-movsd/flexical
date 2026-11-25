// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
// Scoring is deliberately separated from the solver so you can retune the
// "feel" (how much a 5-letter word is worth, bonuses, etc.) without touching
// word-finding logic. The Worker uses these numbers for the leaderboard, so
// they are part of the game's public contract — change them and previous
// scores become incomparable.

export interface Rules {
  /** Shortest word that scores at all. Must match the dictionary minimum. */
  minWordLength: number;
  /** Points per word length. Lengths absent here fall back to `defaultPoints`. */
  lengthPoints: Record<number, number>;
  /** Fallback for lengths not listed in `lengthPoints`. */
  defaultPoints: number;
  /** Bonus awarded once when the player has found every word in the rack. */
  allWordsBonus: number;
}

export const DEFAULT_RULES: Rules = {
  minWordLength: 4,
  lengthPoints: {
    4: 1,
    5: 2,
    6: 3,
    7: 5,
    // RACK_SIZE is 7, so nothing longer than 7 is possible unless you change it.
  },
  defaultPoints: 8,
  allWordsBonus: 10,
};

/**
 * TODO(game logic): Points for a single word under `rules`.
 *
 * WHAT IT SHOULD DO
 *   - Look up word.length in `rules.lengthPoints`; if missing, use
 *     `rules.defaultPoints`.
 *   - Return 0 for anything shorter than `rules.minWordLength`.
 *
 * This placeholder implements exactly the above so the app is usable.
 */
export function scoreWord(word: string, rules: Rules = DEFAULT_RULES): number {
  if (word.length < rules.minWordLength) return 0;
  return rules.lengthPoints[word.length] ?? rules.defaultPoints;
}

/** Total score for a set of already-accepted words, excluding any bonus. */
export function baseScore(words: Iterable<string>, rules: Rules = DEFAULT_RULES): number {
  let total = 0;
  for (const word of words) total += scoreWord(word, rules);
  return total;
}

export interface ClassifyInput {
  /** Raw words from this request. */
  submitted: string[];
  /** Words already accepted on previous submissions for this puzzle. */
  foundSoFar: string[];
  /** Every valid word for the rack (from solveRack). */
  solution: string[];
  rules?: Rules;
}

export interface ClassifyResult {
  accepted: string[];
  rejected: { word: string; reason: "duplicate" | "not_in_rack" | "too_short" }[];
  /** Cumulative distinct words now accepted. */
  words: string[];
  scoreGain: number;
  totalScore: number;
  /** True once every solution word has been found. */
  completed: boolean;
}

export type RejectReason = ClassifyResult["rejected"][number]["reason"];

/**
 * TODO(game logic): Score one submission and decide what is accepted.
 *
 * WHAT IT SHOULD DO
 *   - Normalise each submitted word (trim + lowercase).
 *   - Classify:
 *       - already in `foundSoFar` or accepted earlier in this batch -> "duplicate"
 *       - shorter than rules.minWordLength -> "too_short"
 *       - not in `solution` -> "not_in_rack"
 *       - otherwise -> accepted
 *   - New total = baseScore(cumulative words) + allWordsBonus if the cumulative
 *     set now equals `solution`.
 *   - `scoreGain` = new total - old total.
 *
 * NOTE on "unknown": a word can be missing from `solution` either because it is
 * not in the dictionary or because it cannot be built from the rack. Only the
 * server has both facts (solution was produced from the dictionary). If you
 * want to distinguish them, pass the Dictionary in and reject with "unknown"
 * when the word is in the dictionary but not the rack. The `unknown` reason
 * exists in shared/types.ts for that case.
 *
 * This placeholder implements the above. Extend it as your rules require.
 */
export function classifySubmission(input: ClassifyInput): ClassifyResult {
  const rules = input.rules ?? DEFAULT_RULES;
  const solution = new Set(input.solution.map((w) => w.toLowerCase()));
  const words = new Set(input.foundSoFar.map((w) => w.toLowerCase()));

  const accepted: string[] = [];
  const rejected: ClassifyResult["rejected"] = [];

  for (const raw of input.submitted) {
    const word = raw.trim().toLowerCase();
    if (!word) continue;
    if (word.length < rules.minWordLength) {
      rejected.push({ word, reason: "too_short" });
    } else if (words.has(word)) {
      rejected.push({ word, reason: "duplicate" });
    } else if (!solution.has(word)) {
      rejected.push({ word, reason: "not_in_rack" });
    } else {
      words.add(word);
      accepted.push(word);
    }
  }

  const completed = solution.size > 0 && words.size === solution.size;
  const totalScore = baseScore(words, rules) + (completed ? rules.allWordsBonus : 0);
  const previousScore = baseScore(new Set(input.foundSoFar.map((w) => w.toLowerCase())), rules);

  return {
    accepted,
    rejected,
    words: [...words],
    scoreGain: totalScore - previousScore,
    totalScore,
    completed,
  };
}
