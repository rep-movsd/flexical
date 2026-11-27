import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getDictionary } from "../dictionary";
import { ensureGame } from "../games";
import { localDate, parseOffset } from "../time";
import { MIN_GAME_DATE, REVEAL_LOCKS } from "../config";
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
  countUserPlays,
  playerRank,
  upsertPlay,
  wordsOf,
} from "../db/repo";

export const gameRoutes = new Hono<AppEnv>();

/** A date is playable if it is a real YYYY-MM-DD within [MIN_GAME_DATE, today]. */
function playableDate(id: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id) && id >= MIN_GAME_DATE && id <= today;
}

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
  const gamesPlayed = await countUserPlays(db, user.id);
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
      gamesPlayed,
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
    gamesPlayed,
  };
}

// --- Routes (order matters: literal paths before ":id") ---------------------

gameRoutes.get("/today", async (c) => {
  const db = c.env.DB;
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  const game = await ensureGame(db, today);
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user")) });
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
  if (id < MIN_GAME_DATE) return c.json({ error: "invalid_date", message: "That game date is out of range." }, 400);
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
  const db = c.env.DB;
  const id = c.req.param("id");
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  if (!playableDate(id, today)) return c.json({ error: "invalid_date" }, 400);

  const game = await ensureGame(db, id);
  const rows = await gameLeaderboard(db, game.id, 10);
  const top = rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    score: row.score,
    wordsFound: row.words_found,
    badges: computeBadges(wordsOf(row), game.seed_a, game.seed_b) as Badges,
  }));

  // The current player, if they have a run that isn't already in the top 10.
  const user = c.get("user");
  let me = null;
  if (user) {
    const ranked = await playerRank(db, game.id, user.id);
    if (ranked && ranked.rank > top.length) {
      me = {
        rank: ranked.rank,
        username: ranked.username,
        score: ranked.score,
        wordsFound: ranked.words_found,
        badges: computeBadges(wordsOf(ranked), game.seed_a, game.seed_b) as Badges,
      };
    }
  }

  return c.json({ game: gameView(game), top, me });
});

/**
 * Peek at another player's words for a game. While REVEAL_LOCKS is disabled this
 * is harmless; when enabled it records a permanent lock for the requester.
 */
gameRoutes.post("/:id/peek/:username", async (c) => {
  const db = c.env.DB;
  const game = await getGame(db, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const target = await getUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ error: "user_not_found" }, 404);

  const play = await getPlay(db, target.id, game.id);
  if (!play) return c.json({ error: "no_run" }, 404);

  const requester = c.get("user");
  const isSelf = requester?.id === target.id;
  const locked = REVEAL_LOCKS && !isSelf;
  if (locked && requester) await insertReveal(db, requester.id, game.id);

  const words = wordsOf(play);
  return c.json({
    username: target.username,
    score: play.score,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    words,
    locked,
  });
});

gameRoutes.get("/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  if (!playableDate(id, today)) return c.json({ error: "invalid_date" }, 400);
  const game = await ensureGame(db, id);
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user")) });
});
