// Thin data-access layer over D1. SQL lives here so the routes read like game
// logic.

import type { Board } from "../../shared/types";

export interface GameRow {
  id: string;
  date: string;
  seed_a: string;
  seed_b: string;
  letters: string;
  longest_seed_length: number;
  shortest_seed_length: number;
  answer_counts_json: string;
  created_at: number;
}

export interface PlayRow {
  user_id: string;
  game_id: string;
  words_json: string;
  score: number;
  words_found: number;
  hare_count: number;
  hare_score: number;
  hare_played: number;
  finished_at: number;
}

export function getGame(db: D1Database, id: string): Promise<GameRow | null> {
  return db.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<GameRow>();
}

export async function insertGame(db: D1Database, row: GameRow): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO games
         (id, date, seed_a, seed_b, letters, longest_seed_length, shortest_seed_length, answer_counts_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.date,
      row.seed_a,
      row.seed_b,
      row.letters,
      row.longest_seed_length,
      row.shortest_seed_length,
      row.answer_counts_json,
      row.created_at,
    )
    .run();
}

/** Backfill the precomputed answer counts for a game. */
export async function updateGameCounts(
  db: D1Database,
  id: string,
  answerCountsJson: string,
): Promise<void> {
  await db
    .prepare("UPDATE games SET answer_counts_json = ? WHERE id = ?")
    .bind(answerCountsJson, id)
    .run();
}

/** Seeds used by recently created games, to avoid repeats. */
export async function recentSeeds(db: D1Database, limit = 200): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT seed_a, seed_b FROM games ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<{ seed_a: string; seed_b: string }>();
  const set = new Set<string>();
  for (const row of results) {
    if (row.seed_a) set.add(row.seed_a);
    if (row.seed_b) set.add(row.seed_b);
  }
  return set;
}

export function getPlay(
  db: D1Database,
  userId: string,
  gameId: string,
): Promise<PlayRow | null> {
  return db
    .prepare("SELECT * FROM plays WHERE user_id = ? AND game_id = ?")
    .bind(userId, gameId)
    .first<PlayRow>();
}

/**
 * Insert or overwrite a player's run for a game. Words only ever accumulate, so
 * a later save is always a superset — there is no "best score" comparison to do.
 */
export async function upsertPlay(db: D1Database, play: PlayRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO plays
         (user_id, game_id, words_json, score, words_found,
          hare_count, hare_score, hare_played, duration_ms, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(user_id, game_id) DO UPDATE SET
         words_json = excluded.words_json,
         score = excluded.score,
         words_found = excluded.words_found,
         hare_count = excluded.hare_count,
         hare_score = excluded.hare_score,
         hare_played = excluded.hare_played,
         finished_at = excluded.finished_at`,
    )
    .bind(
      play.user_id,
      play.game_id,
      play.words_json,
      play.score,
      play.words_found,
      play.hare_count,
      play.hare_score,
      play.hare_played,
      play.finished_at,
    )
    .run();
}

/**
 * The words in a stored run. Tolerates the old timeline shape
 * (`[{word,t}]`) as well as the current plain `["stone", …]`.
 */
export function wordsOf(row: { words_json: string }): string[] {
  const raw = JSON.parse(row.words_json) as unknown[];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") out.push(entry);
    else if (entry && typeof (entry as { word?: unknown }).word === "string") {
      out.push((entry as { word: string }).word);
    }
  }
  return out;
}

export interface LeaderboardDbRow {
  username: string;
  score: number;
  hare_score: number;
  hare_played: number;
  words_found: number;
  words_json: string;
}

export async function gameLeaderboard(
  db: D1Database,
  gameId: string,
  limit: number,
  board: Board = "tortoises",
): Promise<LeaderboardDbRow[]> {
  const where = board === "hares" ? "AND p.hare_played = 1" : "";
  const order =
    board === "hares" ? "p.hare_score DESC, p.finished_at ASC" : "p.score DESC, p.finished_at ASC";
  const { results } = await db
    .prepare(
      `SELECT u.username AS username, p.score AS score, p.hare_score AS hare_score,
              p.hare_played AS hare_played, p.words_found AS words_found, p.words_json AS words_json
       FROM plays p JOIN users u ON u.id = p.user_id
       WHERE p.game_id = ? ${where}
       ORDER BY ${order}
       LIMIT ?`,
    )
    .bind(gameId, limit)
    .all<LeaderboardDbRow>();
  return results;
}

export interface AllTimeDbRow {
  username: string;
  total: number;
  games: number;
  words: number;
}

export type AllTimeSort = "points" | "games" | "avg";

export async function allTime(
  db: D1Database,
  limit: number,
  sort: AllTimeSort = "points",
  board: Board = "tortoises",
): Promise<AllTimeDbRow[]> {
  const where = board === "hares" ? "WHERE p.hare_played = 1" : "";
  const totalExpr = board === "hares" ? "SUM(p.hare_score)" : "SUM(p.score)";
  const gamesExpr = "COUNT(*)";
  const avgExpr = `(CAST(${totalExpr} AS REAL) / NULLIF(${gamesExpr}, 0))`;
  const order =
    sort === "games"
      ? `${gamesExpr} DESC, ${totalExpr} DESC`
      : sort === "avg"
        ? `${avgExpr} DESC, ${totalExpr} DESC`
        : `${totalExpr} DESC`;

  const { results } = await db
    .prepare(
      `SELECT u.username AS username,
              ${totalExpr} AS total,
              ${gamesExpr} AS games,
              SUM(p.words_found) AS words
       FROM plays p JOIN users u ON u.id = p.user_id
       ${where}
       GROUP BY p.user_id
       ORDER BY ${order}, u.username ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<AllTimeDbRow>();
  return results;
}

/** How many games a player has recorded a run for (used for onboarding). */
export async function countUserPlays(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM plays WHERE user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** A single player's row on a game board, with their rank. */
export interface RankedPlay {
  rank: number;
  username: string;
  score: number;
  hare_score: number;
  hare_played: number;
  words_found: number;
  words_json: string;
}

/** The player's row + rank for a game (on the chosen board), or null. */
export async function playerRank(
  db: D1Database,
  gameId: string,
  userId: string,
  board: Board = "tortoises",
): Promise<RankedPlay | null> {
  const metric = board === "hares" ? "hare_score" : "score";
  const where = board === "hares" ? "AND p.hare_played = 1" : "";
  const play = await db
    .prepare(
      `SELECT u.username AS username, p.score AS score, p.hare_score AS hare_score,
              p.hare_played AS hare_played, p.words_found AS words_found,
              p.words_json AS words_json, p.finished_at AS finished_at
       FROM plays p JOIN users u ON u.id = p.user_id
       WHERE p.game_id = ? AND p.user_id = ? ${where}`,
    )
    .bind(gameId, userId)
    .first<Omit<RankedPlay, "rank"> & { finished_at: number }>();
  if (!play) return null;

  const { results } = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM plays
       WHERE game_id = ? ${board === "hares" ? "AND hare_played = 1" : ""}
         AND (${metric} > ? OR (${metric} = ? AND finished_at < ?))`,
    )
    .bind(gameId, play[metric], play[metric], play.finished_at)
    .all<{ n: number }>();

  return {
    rank: (results[0]?.n ?? 0) + 1,
    username: play.username,
    score: play.score,
    hare_score: play.hare_score,
    hare_played: play.hare_played,
    words_found: play.words_found,
    words_json: play.words_json,
  };
}

/** Every daily score a player has recorded, newest first, with game seeds. */
export interface DailyScoreRow {
  date: string;
  score: number;
  hare_score: number;
  hare_played: number;
  words_found: number;
  words_json: string;
  seed_a: string;
  seed_b: string;
}

export async function userDailyScores(
  db: D1Database,
  userId: string,
  limit = 400,
): Promise<DailyScoreRow[]> {
  const { results } = await db
    .prepare(
      `SELECT p.game_id AS date, p.score AS score, p.hare_score AS hare_score,
              p.hare_played AS hare_played, p.words_found AS words_found,
              p.words_json AS words_json, g.seed_a AS seed_a, g.seed_b AS seed_b
       FROM plays p JOIN games g ON g.id = p.game_id
       WHERE p.user_id = ?
       ORDER BY p.game_id DESC
       LIMIT ?`,
    )
    .bind(userId, limit)
    .all<DailyScoreRow>();
  return results;
}

/** Usernames for the opponents autocomplete. */
export async function listUsernames(db: D1Database, limit = 500): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT username FROM users ORDER BY username_lower ASC LIMIT ?")
    .bind(limit)
    .all<{ username: string }>();
  return results.map((row) => row.username);
}

export async function hasRevealed(
  db: D1Database,
  userId: string,
  gameId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS x FROM reveals WHERE user_id = ? AND game_id = ?")
    .bind(userId, gameId)
    .first<{ x: number }>();
  return row !== null;
}

export async function insertReveal(
  db: D1Database,
  userId: string,
  gameId: string,
): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO reveals (user_id, game_id, revealed_at) VALUES (?, ?, ?)")
    .bind(userId, gameId, Date.now())
    .run();
}

export function getUserByUsername(
  db: D1Database,
  username: string,
): Promise<{ id: string; username: string } | null> {
  return db
    .prepare("SELECT id, username FROM users WHERE username_lower = ?")
    .bind(username.toLowerCase())
    .first<{ id: string; username: string }>();
}
