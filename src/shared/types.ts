// Shapes shared by the client and the Worker. Keep this file free of any
// browser- or Worker-specific types so both sides can import it.

/** A user as exposed over the API (never includes password material). */
export interface PublicUser {
  id: string;
  username: string;
  createdAt: number;
}

/** A user's standing on a single puzzle's leaderboard. */
export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  wordsFound: number;
}

/** The rack a puzzle is built from, as sent to the client. */
export interface RackView {
  /** Stable id for this puzzle (e.g. "daily:2026-11-25"). */
  id: string;
  /** The letters available to the player, e.g. ["A","E","E","I","P","R","S"]. */
  letters: string[];
  /** Best possible score for this rack, for progress bars. Optional early on. */
  maxScore: number;
}

/** Result of submitting a batch of words for a puzzle. */
export interface SubmitResult {
  /** Words the server accepted on this submission. */
  accepted: string[];
  /** Words the server rejected, with a reason. */
  rejected: { word: string; reason: RejectReason }[];
  /** Points gained by this submission. */
  scoreGain: number;
  /** The player's cumulative score for this puzzle after this submission. */
  totalScore: number;
  /** Every distinct word the player has found so far (accepted, cumulative). */
  words: string[];
}

export type RejectReason = "unknown" | "too_short" | "duplicate" | "not_in_rack";

export interface ApiError {
  error: string;
  message?: string;
}
