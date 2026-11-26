import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppEnv } from "../env";
import { hashPassword, verifyPassword } from "../auth/password";
import { SESSION_COOKIE, createSession, deleteSession } from "../auth/session";
import { passwordProblem } from "../../shared/password";

export const authRoutes = new Hono<AppEnv>();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

function setSessionCookie(c: Context<AppEnv>, id: string, expiresAt: number): void {
  // Secure only over TLS, so local http://localhost dev still works.
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, id, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    expires: new Date(expiresAt),
  });
}

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!USERNAME_RE.test(username)) {
    return c.json(
      { error: "invalid_username", message: "Use 3-16 letters, numbers or underscores." },
      400,
    );
  }
  const problem = passwordProblem(password);
  if (problem) {
    return c.json({ error: "weak_password", message: problem }, 400);
  }

  const lower = username.toLowerCase();
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE username_lower = ?")
    .bind(lower)
    .first();
  if (existing) {
    return c.json({ error: "username_taken", message: "That username is taken." }, 409);
  }

  const { salt, hash, iterations } = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, username, username_lower, salt, hash, iterations, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, username, lower, salt, hash, iterations, now)
      .run();
  } catch {
    // Unique index lost a race with another registration.
    return c.json({ error: "username_taken", message: "That username is taken." }, 409);
  }

  const session = await createSession(c.env.DB, id);
  setSessionCookie(c, session.id, session.expiresAt);
  return c.json({ user: { id, username, createdAt: now } }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return c.json({ error: "invalid_credentials", message: "Enter a username and password." }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, username, salt, hash, iterations, created_at
     FROM users WHERE username_lower = ?`,
  )
    .bind(username.toLowerCase())
    .first<{
      id: string;
      username: string;
      salt: string;
      hash: string;
      iterations: number;
      created_at: number;
    }>();

  // Same response whether the user is unknown or the password is wrong.
  const ok = row
    ? await verifyPassword(password, { salt: row.salt, hash: row.hash, iterations: row.iterations })
    : false;
  if (!row || !ok) {
    return c.json({ error: "invalid_credentials", message: "Wrong username or password." }, 401);
  }

  const session = await createSession(c.env.DB, row.id);
  setSessionCookie(c, session.id, session.expiresAt);
  return c.json({ user: { id: row.id, username: row.username, createdAt: row.created_at } });
});

authRoutes.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) await deleteSession(c.env.DB, sessionId);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", (c) => c.json({ user: c.get("user") }));
