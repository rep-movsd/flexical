// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------
// A Dictionary is the source of truth for "is this a real word?". The shipped
// word list is words.txt (see the repo root), filtered to 4+ letter, purely
// alphabetical entries. The dictionary is loaded once on the Worker and reused
// across requests.

export interface Dictionary {
  /** True if `word` (already lowercased) is a valid word. */
  has(word: string): boolean;
  /** Number of words in the list. */
  readonly size: number;
  /** Iterate every word. Useful for building indexes/tries in solveRack. */
  words(): IterableIterator<string>;
}

/**
 * Build a Dictionary from any iterable of words. Normalises each entry to
 * lowercase and trims whitespace so callers don't have to.
 */
export function createDictionary(input: Iterable<string>): Dictionary {
  const set = new Set<string>();
  for (const raw of input) {
    const w = raw.trim().toLowerCase();
    if (w) set.add(w);
  }
  return {
    get size() {
      return set.size;
    },
    has: (word) => set.has(word),
    words: () => set.values(),
  };
}

/** Parse a newline-separated word list (e.g. the contents of words.txt). */
export function parseDictionary(text: string): Dictionary {
  return createDictionary(text.split("\n"));
}
