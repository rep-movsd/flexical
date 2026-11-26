import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireUser } from "../auth/middleware";
import { getDictionary } from "../dictionary";
import { ensureGame } from "../games";
import { localDate, parseOffset } from "../time";
import {
  classifyWords,
  computeBadgeWords,
  computeBadges,
  computeK,
  isBuildable,
  normalizeWord,
  pointsForLength,
  toLetterSet,
  wordMarks,
  MIN_WORD_LENGTH,
  type Badges,
  type TimelineEntry,
} from "../../shared/engine";
import type { GameRow, PlayRow } from "../db/repo";
import {
  gameLeaderboard,
  getGame,
  getPlay,
  getUserByUsername,
  hasRevealed,
  insertPlayToday,
  insertReveal,
  listGames,
  topRuns,
  upsertBestPlay,
} from "../db/repo";

export const gameRoutes = new Hono<AppEnv>();

/** Longest timestamp we will trust from a client (6 hours). */
const MAX_T_MS = 6 * 60 * 60 * 1000;

function clampT(value: unknown): number {
  const t = Number(value);
  if (!Number.isFinite(t) || t < 0) return 0;
  return Math.min(Math.trunc(t), MAX_T_MS);
}

function gameView(game: GameRow) {
  return {
    id: game.id,
    date: game.date,
    letters: game.letters.split(""),
    longestSeedLength: game.longest_seed_length,
    shortestSeedLength: game.shortest_seed_length,
    k: computeK(game.longest_seed_length),
  };
}

function timelineOf(play: PlayRow): TimelineEntry[] {
  return JSON.parse(play.words_json) as TimelineEntry[];
}

function submitResponse(game: GameRow, play: PlayRow, locked: boolean) {
  const words = timelineOf(play).map((entry) => entry.word);
  return {
    accepted: words,
    rejected: [] as { word: string; reason: string }[],
    score: play.score,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    badgeWords: computeBadgeWords(words, game.seed_a, game.seed_b),
    bestScore: play.score,
    words,
    locked,
  };
}

async function meView(
  db: D1Database,
  game: GameRow,
  user: { id: string } | null,
  today: string,
) {
  if (!user) return null;
  const play = await getPlay(db, user.id, game.id);
  const revealed = await hasRevealed(db, user.id, game.id);
  const isToday = game.id === today;

  if (!play) {
    return {
      played: false,
      revealed,
      locked: revealed,
      bestScore: 0,
      words: [] as string[],
      timeline: [] as TimelineEntry[],
      badges: computeBadges([], game.seed_a, game.seed_b),
      badgeWords: computeBadgeWords([], game.seed_a, game.seed_b),
    };
  }

  const timeline = timelineOf(play);
  const words = timeline.map((entry) => entry.word);
  return {
    played: true,
    revealed,
    locked: revealed || isToday,
    bestScore: play.score,
    words,
    timeline,
    badges: computeBadges(words, game.seed_a, game.seed_b),
    badgeWords: computeBadgeWords(words, game.seed_a, game.seed_b),
  };
}

// --- Routes (order matters: literal paths before ":id") ---------------------

gameRoutes.get("/today", async (c) => {
  const db = c.env.DB;
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  const game = await ensureGame(db, today);
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user"), today) });
});

gameRoutes.get("/", async (c) => {
  const db = c.env.DB;
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  const user = c.get("user");
  const rows = await listGames(db, today, user?.id ?? null);

  const games = rows.map((row) => {
    const revealed = row.revealed !== null;
    const playedToday = row.id === today && row.best_score !== null;
    return {
      id: row.id,
      date: row.date,
      isToday: row.id === today,
      bestScore: row.best_score ?? 0,
      revealed,
      locked: revealed || playedToday,
    };
  });
  return c.json({ games });
});

gameRoutes.get("/:id/race", async (c) => {
  const db = c.env.DB;
  const game = await getGame(db, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const user = c.get("user");
  const runs = await topRuns(db, game.id, 5, user?.id ?? null);
  const k = computeK(game.longest_seed_length);

  const ghosts = runs.map((run) => {
    const words = timelineOf(run).map((entry) => entry.word);
    return {
      username: run.username,
      score: run.score,
      wordsFound: run.words_found,
      badges: computeBadges(words, game.seed_a, game.seed_b),
      timeline: timelineOf(run).map((entry) => ({
        len: entry.word.length,
        points: pointsForLength(entry.word.length, k),
        t: clampT(entry.t),
      })),
    };
  });
  return c.json({ ghosts });
});

gameRoutes.post("/:id/check", async (c) => {
  const game = await getGame(c.env.DB, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const body = await c.req.json().catch(() => null);
  const words: string[] = Array.isArray(body?.words)
    ? (body.words as unknown[]).filter((w): w is string => typeof w === "string")
    : [];

  const allowed = toLetterSet(game.letters.split(""));
  const dict = getDictionary();

  const results = words.map((raw) => {
    const word = normalizeWord(raw);
    let valid = true;
    let reason: string | null = null;
    if (word.length < MIN_WORD_LENGTH) {
      valid = false;
      reason = "too_short";
    } else if (!isBuildable(word, allowed)) {
      valid = false;
      reason = "not_in_rack";
    } else if (!dict.has(word)) {
      valid = false;
      reason = "unknown";
    }
    return {
      word,
      valid,
      reason,
      marks: valid ? wordMarks(word, game.seed_a, game.seed_b) : [],
    };
  });

  return c.json({ results });
});

gameRoutes.get("/:id/leaderboard", async (c) => {
  const game = await getGame(c.env.DB, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);

  const rows = await gameLeaderboard(c.env.DB, game.id, 100);
  const board = rows.map((row, index) => {
    const words = (JSON.parse(row.words_json) as TimelineEntry[]).map((entry) => entry.word);
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

gameRoutes.post("/:id/submit", requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));

  const game = await getGame(db, id);
  if (!game) return c.json({ error: "not_found" }, 404);
  if (id > today) return c.json({ error: "future_game", message: "That game isn't available yet." }, 403);
  if (await hasRevealed(db, user.id, id)) {
    return c.json({ error: "revealed", message: "You revealed this game, so it's locked." }, 403);
  }

  const isToday = id === today;
  const existing = await getPlay(db, user.id, id);
  if (isToday && existing) {
    return c.json(submitResponse(game, existing, true));
  }

  const body = await c.req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.words) ? body.words : [];
  const submitted = raw
    .filter((entry): entry is { word: string; t?: unknown } =>
      !!entry && typeof (entry as { word?: unknown }).word === "string",
    )
    .map((entry) => ({ word: entry.word, t: clampT(entry.t) }));

  const allowed = toLetterSet(game.letters.split(""));
  const k = computeK(game.longest_seed_length);
  const result = classifyWords(submitted, allowed, getDictionary(), k);

  const tByWord = new Map<string, number>();
  for (const entry of submitted) {
    const word = normalizeWord(entry.word);
    if (!tByWord.has(word)) tByWord.set(word, entry.t);
  }
  const timeline: TimelineEntry[] = result.accepted
    .map((word) => ({ word, t: tByWord.get(word) ?? 0 }))
    .sort((a, b) => a.t - b.t);

  const play: PlayRow = {
    user_id: user.id,
    game_id: id,
    words_json: JSON.stringify(timeline),
    score: result.score,
    words_found: timeline.length,
    duration_ms: timeline.length ? timeline[timeline.length - 1].t : 0,
    finished_at: Date.now(),
  };

  let bestScore = result.score;
  if (isToday) {
    const inserted = await insertPlayToday(db, play);
    if (!inserted) {
      const stored = await getPlay(db, user.id, id);
      if (stored) return c.json(submitResponse(game, stored, true));
    }
  } else {
    await upsertBestPlay(db, play);
    const stored = await getPlay(db, user.id, id);
    bestScore = stored?.score ?? result.score;
  }

  return c.json({
    accepted: result.accepted,
    rejected: result.rejected,
    score: result.score,
    badges: computeBadges(result.accepted, game.seed_a, game.seed_b),
    badgeWords: computeBadgeWords(result.accepted, game.seed_a, game.seed_b),
    bestScore,
    words: result.accepted,
    locked: isToday,
  });
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

  const words = timelineOf(play).map((entry) => entry.word);
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
  const game = await getGame(db, c.req.param("id"));
  if (!game) return c.json({ error: "not_found" }, 404);
  const today = localDate(parseOffset(c.req.header("X-TZ-Offset")));
  return c.json({ game: gameView(game), me: await meView(db, game, c.get("user"), today) });
});
