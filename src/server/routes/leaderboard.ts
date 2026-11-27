import { Hono } from "hono";
import type { AppEnv } from "../env";
import { allTime, type AllTimeSort } from "../db/repo";
import type { Board } from "../../shared/types";

export const leaderboardRoutes = new Hono<AppEnv>();

const SORTS: AllTimeSort[] = ["points", "games", "avg"];

/**
 * All-time board: each player's total across every game (Tortoises), or the sum of
 * their timed scores (Hares), plus games played and the average per game.
 */
leaderboardRoutes.get("/alltime", async (c) => {
  const raw = c.req.query("sort");
  const sort: AllTimeSort = SORTS.includes(raw as AllTimeSort) ? (raw as AllTimeSort) : "points";
  const board: Board = c.req.query("board") === "hares" ? "hares" : "tortoises";

  const rows = await allTime(c.env.DB, 100, sort, board);
  return c.json({
    board,
    rows: rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      total: row.total,
      games: row.games,
      avg: row.games > 0 ? Math.round(row.total / row.games) : 0,
    })),
  });
});
