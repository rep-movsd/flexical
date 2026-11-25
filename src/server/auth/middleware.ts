import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { SESSION_COOKIE, getSessionUser } from "./session";

/**
 * Populates `c.var.user` from the session cookie (or null). Runs for every
 * /api/* request; handlers decide whether auth is required.
 */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    c.set("user", await getSessionUser(c.env.DB, sessionId));
  }
  await next();
});

/** Guard for routes that require a signed-in user. Mount after `loadUser`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) {
    return c.json({ error: "not_authenticated", message: "Sign in to continue." }, 401);
  }
  await next();
});
