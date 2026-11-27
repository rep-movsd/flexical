import { Hono } from "hono";
import type { AppEnv } from "../env";
import { computeBadges } from "../../shared/engine";
import { getUserByUsername, listUsernames, userDailyScores, wordsOf } from "../db/repo";

export const userRoutes = new Hono<AppEnv>();

/** Usernames for the opponents autocomplete. */
userRoutes.get("/", async (c) => {
  return c.json({ usernames: await listUsernames(c.env.DB) });
});

/** Every daily score a player has recorded (for the "opponents" view). */
userRoutes.get("/:username/scores", async (c) => {
  const user = await getUserByUsername(c.env.DB, c.req.param("username"));
  if (!user) return c.json({ error: "user_not_found" }, 404);

  const rows = await userDailyScores(c.env.DB, user.id);
  const scores = rows.map((row) => ({
    date: row.date,
    score: row.score,
    wordsFound: row.words_found,
    badges: computeBadges(wordsOf(row), row.seed_a, row.seed_b),
  }));
  const total = rows.reduce((sum, row) => sum + row.score, 0);

  return c.json({ username: user.username, total, games: rows.length, rows: scores });
});
