// Shapes shared by the client and the Worker. Keep this file free of any
// browser- or Worker-specific types. Domain types that the engine already owns
// (badges, timeline) are re-exported rather than duplicated.

import type { BadgeKind, BadgeWords, Badges } from "./engine/badges";
import type { GhostWord, TimelineEntry } from "./engine/timeline";

export type { BadgeKind, BadgeWords, Badges, GhostWord, TimelineEntry };

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
}

/** The current player's state for a game. */
export interface MeView {
  played: boolean;
  revealed: boolean;
  locked: boolean;
  bestScore: number;
  words: string[];
  timeline: TimelineEntry[];
  badges: Badges;
  badgeWords: BadgeWords;
}

export interface GameResponse {
  game: GameView;
  me: MeView | null;
}

/** A replayed top run, shown in race mode without revealing words. */
export interface Ghost {
  username: string;
  score: number;
  wordsFound: number;
  badges: Badges;
  timeline: GhostWord[];
}

export interface RaceResponse {
  ghosts: Ghost[];
}

export interface SubmitResult {
  accepted: string[];
  rejected: { word: string; reason: string }[];
  score: number;
  badges: Badges;
  badgeWords: BadgeWords;
  bestScore: number;
  words: string[];
  locked: boolean;
}

export interface ArchiveGame {
  id: string;
  date: string;
  isToday: boolean;
  bestScore: number;
  revealed: boolean;
  locked: boolean;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  wordsFound: number;
  badges: Badges;
}

export interface LeaderboardResponse {
  game: GameView;
  rows: LeaderboardRow[];
}

export interface AllTimeRow {
  rank: number;
  username: string;
  total: number;
  games: number;
  words: number;
}

export interface RevealResult {
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
