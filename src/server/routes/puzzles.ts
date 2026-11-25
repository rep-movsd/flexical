import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getDictionary } from "../dictionary";
import {
  DEFAULT_RULES,
  baseScore,
  classifySubmission,
  generateRack,
  solveRack,
} from "../../shared/engine";
import type { PuzzleRow } from "../db/repo";
import { dailyPuzzleId, getPlay, getPuzzle, insertPuzzle, upsertPlay } from "../db/repo";
import type { RackView, SubmitResult } from "../../shared/types";

export const puzzleRoutes = new Hono<AppEnv>();

/**
 * Load a puzzle by id, creating it on first request. The Worker owns both the
 * rack and the answer set, so the client never sees the solution until it has
 * been earned.
 */
async function ensurePuzzle(db: D1Database, id: string): Promise<PuzzleRow> {
  const existing = await getPuzzle(db, id);
  if (existing) return existing;

  const rack = generateRack();
  // TODO(game logic): your solveRack fills this in. Until then it is empty.
  const solution = solveRack(rack, getDictionary(), DEFAULT_RULES.minWordLength);
  const maxScore =
    baseScore(solution, DEFAULT_RULES) + (solution.length > 0 ? DEFAULT_RULES.allWordsBonus : 0);

  const row: PuzzleRow = {
    id,
    rack: rack.letters.join(""),
    solution_json: JSON.stringify(solution),
    max_score: maxScore,
    created_at: Date.now(),
    league_id: null,
  };
  await insertPuzzle(db, row);
  // Re-read in case a concurrent request inserted first.
  return (await getPuzzle(db, id)) ?? row;
}

function toRackView(puzzle: PuzzleRow): RackView {
  return {
    id: puzzle.id,
    letters: puzzle.rack.split(""),
    maxScore: puzzle.max_score,
  };
}

puzzleRoutes.get("/today", async (c) => {
  const puzzle = await ensurePuzzle(c.env.DB, dailyPuzzleId());
  return c.json({ puzzle: toRackView(puzzle) });
});

puzzleRoutes.get("/:id", async (c) => {
  const puzzle = await getPuzzle(c.env.DB, c.req.param("id"));
  if (!puzzle) return c.json({ error: "not_found" }, 404);
  return c.json({ puzzle: toRackView(puzzle) });
});

puzzleRoutes.post("/:id/submit", async (c) => {
  const id = c.req.param("id");
  const puzzle = await getPuzzle(c.env.DB, id);
  if (!puzzle) return c.json({ error: "not_found" }, 404);

  const body = await c.req.json().catch(() => null);
  const submitted: string[] = Array.isArray(body?.words)
    ? (body.words as unknown[]).filter((w): w is string => typeof w === "string")
    : [];

  const solution = JSON.parse(puzzle.solution_json) as string[];
  const user = c.get("user");
  const play = user ? await getPlay(c.env.DB, user.id, id) : null;
  const foundSoFar = play ? (JSON.parse(play.words_json) as string[]) : [];

  const result = classifySubmission({
    submitted,
    foundSoFar,
    solution,
    rules: DEFAULT_RULES,
  });

  // Anonymous players can still check words; only signed-in players are ranked.
  if (user) {
    await upsertPlay(c.env.DB, user.id, id, result.words, result.totalScore);
  } else {
    // Persist nothing, but still return the same shape.
  }

  const payload: SubmitResult = {
    accepted: result.accepted,
    rejected: result.rejected,
    scoreGain: result.scoreGain,
    totalScore: result.totalScore,
    words: result.words,
  };
  return c.json(payload);
});
