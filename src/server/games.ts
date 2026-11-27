import {
  MIN_WORD_LENGTH,
  allowedLetters,
  countAnswersByLength,
  pickSeed,
  toLetterSet,
} from "../shared/engine";
import { getDictionary } from "./dictionary";
import type { GameRow } from "./db/repo";
import { getGame, insertGame, recentSeeds, updateGameCounts } from "./db/repo";

/** Precompute the per-length answer counts for a rack. */
function answerCountsJson(letters: string): string {
  const counts = countAnswersByLength(
    toLetterSet(letters.split("")),
    getDictionary(),
    MIN_WORD_LENGTH,
  );
  return JSON.stringify(counts);
}

/**
 * Load the game for a date, generating it on first request. The seed word is
 * chosen deterministically from the date, avoiding recent repeats, and the
 * answer counts are precomputed once and stored.
 */
export async function ensureGame(db: D1Database, date: string): Promise<GameRow> {
  const existing = await getGame(db, date);
  if (existing) {
    // Backfill counts for games created before this was stored.
    if (!existing.answer_counts_json || existing.answer_counts_json === "[]") {
      const json = answerCountsJson(existing.letters);
      await updateGameCounts(db, date, json);
      return { ...existing, answer_counts_json: json };
    }
    return existing;
  }

  const dictionary = getDictionary();
  const avoid = await recentSeeds(db, 200);
  // A game is built from a single seed word.
  const seed = pickSeed(date, dictionary, avoid);
  const letters = allowedLetters(seed);

  const row: GameRow = {
    id: date,
    date,
    seed_a: seed,
    seed_b: "",
    letters: letters.join(""),
    longest_seed_length: seed.length,
    shortest_seed_length: seed.length,
    answer_counts_json: answerCountsJson(letters.join("")),
    created_at: Date.now(),
  };
  await insertGame(db, row);
  return (await getGame(db, date)) ?? row;
}

/** Backfill precomputed counts for an existing game if they are missing. */
export async function ensureCounts(db: D1Database, game: GameRow): Promise<GameRow> {
  if (game.answer_counts_json && game.answer_counts_json !== "[]") return game;
  const json = answerCountsJson(game.letters);
  await updateGameCounts(db, game.id, json);
  return { ...game, answer_counts_json: json };
}
