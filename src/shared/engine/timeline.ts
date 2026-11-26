// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
// A stored run records the moment each word was found, so race mode can replay
// it at the original pace. Everything here is pure and shared by client/server.

export interface TimelineEntry {
  word: string;
  /** Milliseconds since the attempt started. */
  t: number;
}

/** A single ghost word, with no letters revealed — only its shape and value. */
export interface GhostWord {
  /** Word length (for "found a 7-letter word" pings). */
  len: number;
  points: number;
  t: number;
}

export interface GhostProgress {
  score: number;
  count: number;
}

/** Cumulative score and word count for a ghost at elapsed time `t`. */
export function progressAt(timeline: GhostWord[], t: number): GhostProgress {
  let score = 0;
  let count = 0;
  for (const entry of timeline) {
    if (entry.t > t) break;
    score += entry.points;
    count++;
  }
  return { score, count };
}
