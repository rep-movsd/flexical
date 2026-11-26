import { Hono } from "hono";
import type { AppEnv } from "../env";
import { allTime } from "../db/repo";

export const leaderboardRoutes = new Hono<AppEnv>();

/** All-time "marathon" board: sum of each player's best score on every game. */
leaderboardRoutes.get("/alltime", async (c) => {
  const rows = await allTime(c.env.DB, 100);
  return c.json({
    rows: rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      total: row.total,
      games: row.games,
      words: row.words,
    })),
  });
});
