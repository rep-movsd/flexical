import type { Dictionary } from "./dictionary";
import type { Rack } from "./rack";

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------
// Given a rack and the dictionary, produce every valid word a player could
// find. The Worker runs this once when it creates a puzzle and stores the
// result; the client then submits words and the server just checks membership.
// That means the solver runs rarely, so correctness matters far more than raw
// speed — but see the performance notes below if a rack ever feels slow.

/**
 * TODO(game logic): Return all valid words buildable from `rack`.
 *
 * WHAT IT SHOULD DO
 *   - Return lowercase words, de-duplicated, each at least `minLength` letters.
 *   - A word is valid iff (a) it is in `dict` and (b) `canBuild(word, rack)`.
 *   - Order is up to you (callers should not depend on it). Sorting by length
 *     then alphabetically makes a nicer UI, but the server can sort too.
 *
 * ALGORITHM OPTIONS
 *   1. Brute force (simplest to get right):
 *        - For each length L from minLength..RACK_SIZE, generate every distinct
 *          arrangement of L letters from the rack and test each against `dict`.
 *        - De-duplicate with a Set before checking, since repeated letters
 *          (e.g. two E's) produce identical permutations.
 *      Fine for RACK_SIZE=7 and a small L range; rearrange the letters in a
 *      sorted array and use next-permutation to avoid a Set explosion.
 *   2. Prefix trie (the usual "good" solution):
 *        - Build a trie over `dict.words()` once (cache it — the Dictionary is
 *          reused across requests, so build the trie lazily and memoise).
 *        - DFS over rack letters, pruning whenever the current prefix is not in
 *          the trie. Emit a word when a trie node marks a complete word of
 *          length >= minLength. This visits only reachable prefixes and is much
 *          faster on dense racks.
 *
 * PERFORMANCE NOTES
 *   - Building a trie for ~39k words is cheap (~O(total letters)) but do it at
 *     most once per Worker isolate; keep it in module scope, not per request.
 *   - If a rack has many repeated letters, the number of distinct prefixes is
 *     tiny; a trie handles this naturally.
 *
 * This placeholder returns an empty array so the rest of the app runs before
 * the real logic exists. Replace the body.
 */
export function solveRack(
  _rack: Rack,
  _dict: Dictionary,
  _minLength = 4,
): string[] {
  // TODO(game logic)
  return [];
}
