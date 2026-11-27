// Shapes shared by the client and the Worker. Keep this file free of any
// browser- or Worker-specific types. Domain types that the engine already owns
// (badges, timeline) are re-exported rather than duplicated.

import type { AnswerCount } from "./engine/answers";
import type { BadgeKind, BadgeWords, Badges } from "./engine/badges";

export type { AnswerCount, BadgeKind, BadgeWords, Badges };

/** A user as exposed over the API (never includes password material). */
export interface PublicUser {
  id: string;
  username: string;
  createdAt: number;
}

/** The puzzle as sent to the client. Seed words are never included. */
export interface GameView {
  id: string;
  date: string;
  letters: string[];
  longestSeedLength: number;
  shortestSeedLength: number;
  /** Scoring constant K derived from longestSeedLength. */
  k: number;
  /** Precomputed number of valid answers per word length. */
  counts: AnswerCount[];
}

/** The current player's state for a game. Words keep their find order. */
export interface MeView {
  played: boolean;
  revealed: boolean;
  locked: boolean;
  score: number;
  bestScore: number;
  words: string[];
  badges: Badges;
  badgeWords: BadgeWords;
}

export interface GameResponse {
  game: GameView;
  me: MeView | null;
}

/** Result of auto-saving the player's word set for a game. */
export interface SaveResult {
  accepted: string[];
  rejected: { word: string; reason: string }[];
  score: number;
  badges: Badges;
  badgeWords: BadgeWords;
  words: string[];
  bestScore: number;
  locked: boolean;
  /** True when the words were written to the player's saved run. */
  persisted: boolean;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  wordsFound: number;
  badges: Badges;
}

/** A game board: the top rows plus the viewer's own row if outside the top. */
export interface GameLeaderboardResponse {
  game: GameView;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
}

/** A row on the all-time leaderboard. */
export interface AllTimeRow {
  rank: number;
  username: string;
  total: number;
  games: number;
  avg: number;
}

export type AllTimeSort = "points" | "games" | "avg";

/** One daily score in a player's history. */
export interface OpponentScoreRow {
  date: string;
  score: number;
  wordsFound: number;
  badges: Badges;
}

export interface OpponentResponse {
  username: string;
  total: number;
  games: number;
  rows: OpponentScoreRow[];
}

/** The words revealed when peeking at another player's run. */
export interface PeekResult {
  username: string;
  score: number;
  badges: Badges;
  words: string[];
  locked: boolean;
}

export interface ApiError {
  error: string;
  message?: string;
}
