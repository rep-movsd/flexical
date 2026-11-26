import { allowedLetters, pickSeeds } from "../shared/engine";
import { getDictionary } from "./dictionary";
import type { GameRow } from "./db/repo";
import { getGame, insertGame, recentSeedPairs } from "./db/repo";

/**
 * Load the game for a date, generating it on first request. The pair of seed
 * words is chosen deterministically from the date, avoiding recent repeats.
 */
export async function ensureGame(db: D1Database, date: string): Promise<GameRow> {
  const existing = await getGame(db, date);
  if (existing) return existing;

  const dictionary = getDictionary();
  const avoid = await recentSeedPairs(db, 120);
  const [seedA, seedB] = pickSeeds(date, dictionary, avoid);
  const letters = allowedLetters(seedA, seedB);

  const row: GameRow = {
    id: date,
    date,
    seed_a: seedA,
    seed_b: seedB,
    letters: letters.join(""),
    longest_seed_length: Math.max(seedA.length, seedB.length),
    shortest_seed_length: Math.min(seedA.length, seedB.length),
    created_at: Date.now(),
  };
  await insertGame(db, row);
  return (await getGame(db, date)) ?? row;
}
