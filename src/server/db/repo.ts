import type { LeaderboardRow } from "../../shared/types";

// Thin data-access layer over D1. Keeping SQL here (rather than in route
// handlers) makes the routes read like game logic.

export interface PuzzleRow {
  id: string;
  /** Rack letters concatenated, uppercase, e.g. "AEEIPRS". */
  rack: string;
  /** JSON array of valid words for the rack. */
  solution_json: string;
  max_score: number;
  created_at: number;
  league_id: string | null;
}

export interface PlayRow {
  id: string;
  user_id: string;
  puzzle_id: string;
  words_json: string;
  score: number;
  finished_at: number;
}

/** Stable id for the puzzle served on a given UTC day. */
export function dailyPuzzleId(date = new Date()): string {
  return `daily:${date.toISOString().slice(0, 10)}`;
}

export function getPuzzle(db: D1Database, id: string): Promise<PuzzleRow | null> {
  return db.prepare("SELECT * FROM puzzles WHERE id = ?").bind(id).first<PuzzleRow>();
}

export async function insertPuzzle(db: D1Database, row: PuzzleRow): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO puzzles
         (id, rack, solution_json, max_score, created_at, league_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.rack, row.solution_json, row.max_score, row.created_at, row.league_id)
    .run();
}

export function getPlay(
  db: D1Database,
  userId: string,
  puzzleId: string,
): Promise<PlayRow | null> {
  return db
    .prepare("SELECT * FROM plays WHERE user_id = ? AND puzzle_id = ?")
    .bind(userId, puzzleId)
    .first<PlayRow>();
}

export async function upsertPlay(
  db: D1Database,
  userId: string,
  puzzleId: string,
  words: string[],
  score: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO plays (id, user_id, puzzle_id, words_json, score, finished_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, puzzle_id) DO UPDATE SET
         words_json = excluded.words_json,
         score = excluded.score,
         finished_at = excluded.finished_at`,
    )
    .bind(crypto.randomUUID(), userId, puzzleId, JSON.stringify(words), score, Date.now())
    .run();
}

interface LeaderboardDbRow {
  username: string;
  score: number;
  words_json: string;
}

export async function getLeaderboard(
  db: D1Database,
  puzzleId: string,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.username AS username, p.score AS score, p.words_json AS words_json
       FROM plays p
       JOIN users u ON u.id = p.user_id
       WHERE p.puzzle_id = ?
       ORDER BY p.score DESC, p.finished_at ASC
       LIMIT ?`,
    )
    .bind(puzzleId, limit)
    .all<LeaderboardDbRow>();

  return results.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    score: row.score,
    wordsFound: (JSON.parse(row.words_json) as string[]).length,
  }));
}
