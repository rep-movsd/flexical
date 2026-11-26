// The client keeps a local copy of the word list so players get instant
// accept/reject feedback and a live score. The server re-validates every
// submission, so this copy is only for UX.

let cache: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;

export function loadDictionary(): Promise<Set<string>> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = fetch("/words.txt")
      .then((response) => {
        if (!response.ok) throw new Error("dictionary unavailable");
        return response.text();
      })
      .then((text) => {
        const set = new Set<string>();
        for (const line of text.split("\n")) {
          const word = line.trim();
          if (word) set.add(word);
        }
        cache = set;
        return set;
      });
  }
  return inFlight;
}
