import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppEnv } from "./env";
import { loadUser, requireUser } from "./auth/middleware";
import { authRoutes } from "./routes/auth";
import { gameRoutes } from "./routes/games";
import { leaderboardRoutes } from "./routes/leaderboard";

const app = new Hono<AppEnv>();

app.use("*", logger());
// Resolve the current user for every API request.
app.use("/api/*", loadUser);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/games", gameRoutes);
app.route("/api/leaderboard", leaderboardRoutes);

// Example of a protected route — useful as a template for future endpoints.
app.get("/api/profile", requireUser, (c) => c.json({ user: c.get("user") }));

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
