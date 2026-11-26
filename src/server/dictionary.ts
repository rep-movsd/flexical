import wordsText from "../../public/words.txt?raw";
import { parseDictionary, type Dictionary } from "../shared/engine";

// words.txt is inlined into the Worker bundle at build time (Vite's `?raw`
// import) and also served to the client as a static asset from public/. Parse
// it once per isolate and reuse.
let cached: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (!cached) cached = parseDictionary(wordsText);
  return cached;
}
