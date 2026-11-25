import { Hono } from "hono";
import type { AppEnv } from "../env";
import { dailyPuzzleId, getLeaderboard } from "../db/repo";

export const leaderboardRoutes = new Hono<AppEnv>();

leaderboardRoutes.get("/today", async (c) => {
  const id = dailyPuzzleId();
  const rows = await getLeaderboard(c.env.DB, id, 50);
  return c.json({ id, rows });
});
