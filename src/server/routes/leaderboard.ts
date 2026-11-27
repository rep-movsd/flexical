import { Hono } from "hono";
import type { AppEnv } from "../env";
import { allTime, type AllTimeSort } from "../db/repo";

export const leaderboardRoutes = new Hono<AppEnv>();

const SORTS: AllTimeSort[] = ["points", "games", "avg"];

/**
 * All-time board: each player's total points across every game, plus how many
 * games they played and their average per game. Sortable by any of the three.
 */
leaderboardRoutes.get("/alltime", async (c) => {
  const raw = c.req.query("sort");
  const sort: AllTimeSort = SORTS.includes(raw as AllTimeSort) ? (raw as AllTimeSort) : "points";

  const rows = await allTime(c.env.DB, 100, sort);
  return c.json({
    rows: rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      total: row.total,
      games: row.games,
      avg: row.games > 0 ? Math.round(row.total / row.games) : 0,
    })),
  });
});
