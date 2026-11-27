// Thin data-access layer over D1. SQL lives here so the routes read like game
// logic.

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
  duration_ms: number;
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

/** Pair keys (`a|b`, sorted) of recently created games, to avoid repeats. */
export async function recentSeedPairs(db: D1Database, limit = 120): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT seed_a, seed_b FROM games ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<{ seed_a: string; seed_b: string }>();
  const set = new Set<string>();
  for (const row of results) {
    const [a, b] = row.seed_a < row.seed_b ? [row.seed_a, row.seed_b] : [row.seed_b, row.seed_a];
    set.add(`${a}|${b}`);
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
 * Record the single allowed submission for today's game. Returns false if a row
 * already existed (so the caller can return the stored result idempotently).
 */
export async function insertPlayToday(db: D1Database, play: PlayRow): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO plays
         (user_id, game_id, words_json, score, words_found, duration_ms, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      play.user_id,
      play.game_id,
      play.words_json,
      play.score,
      play.words_found,
      play.duration_ms,
      play.finished_at,
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** Store a replay only if it beats the existing best score. */
export async function upsertBestPlay(db: D1Database, play: PlayRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO plays
         (user_id, game_id, words_json, score, words_found, duration_ms, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, game_id) DO UPDATE SET
         words_json = excluded.words_json,
         score = excluded.score,
         words_found = excluded.words_found,
         duration_ms = excluded.duration_ms,
         finished_at = excluded.finished_at
       WHERE excluded.score > plays.score`,
    )
    .bind(
      play.user_id,
      play.game_id,
      play.words_json,
      play.score,
      play.words_found,
      play.duration_ms,
      play.finished_at,
    )
    .run();
}

export interface RunRow extends PlayRow {
  username: string;
}

export async function topRuns(
  db: D1Database,
  gameId: string,
  limit: number,
  excludeUserId: string | null,
): Promise<RunRow[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*, u.username AS username
       FROM plays p JOIN users u ON u.id = p.user_id
       WHERE p.game_id = ? AND p.user_id != ?
       ORDER BY p.score DESC, p.finished_at ASC
       LIMIT ?`,
    )
    .bind(gameId, excludeUserId ?? "", limit)
    .all<RunRow>();
  return results;
}

export interface LeaderboardDbRow {
  username: string;
  score: number;
  words_found: number;
  words_json: string;
}

export async function gameLeaderboard(
  db: D1Database,
  gameId: string,
  limit: number,
): Promise<LeaderboardDbRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.username AS username, p.score AS score,
              p.words_found AS words_found, p.words_json AS words_json
       FROM plays p JOIN users u ON u.id = p.user_id
       WHERE p.game_id = ?
       ORDER BY p.score DESC, p.finished_at ASC
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

export async function allTime(db: D1Database, limit: number): Promise<AllTimeDbRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.username AS username,
              SUM(p.score) AS total,
              COUNT(*) AS games,
              SUM(p.words_found) AS words
       FROM plays p JOIN users u ON u.id = p.user_id
       GROUP BY p.user_id
       ORDER BY total DESC, u.username ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<AllTimeDbRow>();
  return results;
}

export interface GameListItem {
  id: string;
  date: string;
  best_score: number | null;
  revealed: string | null;
}

export async function listGames(
  db: D1Database,
  maxDate: string,
  userId: string | null,
  limit = 200,
): Promise<GameListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT g.id AS id, g.date AS date,
              p.score AS best_score, r.user_id AS revealed
       FROM games g
       LEFT JOIN plays p ON p.game_id = g.id AND p.user_id = ?
       LEFT JOIN reveals r ON r.game_id = g.id AND r.user_id = ?
       WHERE g.date <= ?
       ORDER BY g.date DESC
       LIMIT ?`,
    )
    .bind(userId ?? "", userId ?? "", maxDate, limit)
    .all<GameListItem>();
  return results;
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
