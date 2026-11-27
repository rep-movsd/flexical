import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireUser } from "../auth/middleware";
import { getDictionary } from "../dictionary";
import { ensureCounts, ensureGame } from "../games";
import { localDate, parseOffset } from "../time";
import {
  classifyWords,
  computeBadgeWords,
  computeBadges,
  computeK,
  scoreWords,
  toLetterSet,
  type Badges,
} from "../../shared/engine";
import type { GameRow } from "../db/repo";
import {
  gameLeaderboard,
  getGame,
  getPlay,
  getUserByUsername,
  hasRevealed,
  insertReveal,
  listGames,
  upsertPlay,
  wordsOf,
} from "../db/repo";

export const gameRoutes = new Hono<AppEnv>();

function gameView(game: GameRow) {
  return {
    id: game.id,
    date: game.date,
    letters: game.letters.split(""),
    longestSeedLength: game.longest_seed_length,
    shortestSeedLength: game.shortest_seed_length,
    k: computeK(game.longest_seed_length),
    /** Precomputed number of valid answers per word length. */
    counts: JSON.parse(game.answer_counts_json || "[]") as { length: number; count: number }[],
  };
}

/**
 * The signed-in player's state for a game. A game is open indefinitely; the only
 * way it locks is by revealing another player's words.
 */
async function meView(db: D1Database, game: GameRow, user: { id: string } | null) {
  if (!user) return null;
  const play = await getPlay(db, user.id, game.id);
  const revealed = await hasRevealed(db, user.id, game.id);

  if (!play) {
    return {
      played: false,
      revealed,
      locked: revealed,
      score: 0,
      bestScore: 0,
      words: [] as string[],
      badges: computeBadges([], game.seed_a, game.seed_b),
      badgeWords: computeBadgeWords([], game.seed_a, game.seed_b),
    };
  }

  const words = wordsOf(play);
  return {
    played: true,
    revealed,
    locked: revealed,
    score: play.score,
    bestScore: play.score,
    words,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    badgeWords: computeBadgeWords(words, game.seed_a, game.seed_b),
  };
}

// --- Routes (order matters: literal paths before ":id") ---------------------

gameRoutes.get("/today", async (c) => {
  const db = c.env.DB;
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  const game = await ensureGame(db, today);
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user")) });
});

gameRoutes.get("/", async (c) => {
  const db = c.env.DB;
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  const user = c.get("user");
  const rows = await listGames(db, today, user?.id ?? null);

  const games = rows.map((row) => {
    const revealed = row.revealed !== null;
    return {
      id: row.id,
      date: row.date,
      isToday: row.id === today,
      bestScore: row.best_score ?? 0,
      revealed,
      locked: revealed,
    };
  });
  return c.json({ games });
});

/**
 * Auto-save the player's word set. Words only ever accumulate, so the stored run
 * is the union of what we already had and the (validated) incoming words.
 * Anonymous players get a validation + badge response but nothing is stored.
 */
gameRoutes.post("/:id/words", async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const id = c.req.param("id");
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));

  const game = await getGame(db, id);
  if (!game) return c.json({ error: "not_found" }, 404);
  if (id > today) return c.json({ error: "future_game", message: "That game isn't available yet." }, 403);
  if (user && (await hasRevealed(db, user.id, id))) {
    return c.json({ error: "revealed", message: "You revealed this game, so it's locked." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.words) ? body.words : [];
  const submitted = raw.filter((word): word is string => typeof word === "string");

  const allowed = toLetterSet(game.letters.split(""));
  const k = computeK(game.longest_seed_length);
  const result = classifyWords(submitted, allowed, getDictionary(), k);

  let words = result.accepted;
  let score = result.score;
  let persisted = false;

  if (user) {
    const existing = await getPlay(db, user.id, id);
    const merged = existing ? wordsOf(existing) : [];
    const seen = new Set(merged);
    for (const word of result.accepted) {
      if (!seen.has(word)) {
        seen.add(word);
        merged.push(word);
      }
    }
    words = merged;
    score = scoreWords(merged, k);
    await upsertPlay(db, {
      user_id: user.id,
      game_id: id,
      words_json: JSON.stringify(merged),
      score,
      words_found: merged.length,
      finished_at: Date.now(),
    });
    persisted = true;
  }

  return c.json({
    accepted: result.accepted,
    rejected: result.rejected,
    score,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    badgeWords: computeBadgeWords(words, game.seed_a, game.seed_b),
    words,
    bestScore: score,
    locked: false,
    persisted,
  });
});

gameRoutes.get("/:id/leaderboard", async (c) => {
  const game = await getGame(c.env.DB, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const rows = await gameLeaderboard(c.env.DB, game.id, 100);
  const board = rows.map((row, index) => {
    const words = wordsOf(row);
    return {
      rank: index + 1,
      username: row.username,
      score: row.score,
      wordsFound: row.words_found,
      badges: computeBadges(words, game.seed_a, game.seed_b) as Badges,
    };
  });
  return c.json({ game: gameView(game), rows: board });
});

gameRoutes.post("/:id/reveal/:username", requireUser, async (c) => {
  const db = c.env.DB;
  const requester = c.get("user")!;
  const game = await getGame(db, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const target = await getUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ error: "user_not_found" }, 404);

  const play = await getPlay(db, target.id, game.id);
  if (!play) return c.json({ error: "no_run" }, 404);

  const isSelf = target.id === requester.id;
  if (!isSelf) await insertReveal(db, requester.id, game.id);

  const words = wordsOf(play);
  return c.json({
    username: target.username,
    score: play.score,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    words,
    locked: !isSelf,
  });
});

gameRoutes.get("/:id", async (c) => {
  const db = c.env.DB;
  const found = await getGame(db, c.req.param("id"));
  if (!found) return c.json({ error: "not_found" }, 404);
  const game = await ensureCounts(db, found);
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user")) });
});
