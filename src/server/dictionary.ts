import wordsText from "../../words.txt?raw";
import { parseDictionary, type Dictionary } from "../shared/engine";

// words.txt is inlined into the Worker bundle at build time (Vite's `?raw`
// import). ~39k words, a few hundred KB uncompressed — well within the free
// Worker size limit. Parse it once per isolate and reuse.
let cached: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (!cached) cached = parseDictionary(wordsText);
  return cached;
}
