import type { PublicUser } from "../../shared/types";

// Opaque, revocable sessions stored in D1. The cookie carries only the session
// id; nothing sensitive is encoded client-side.

export const SESSION_COOKIE = "fx_session";
/** How long a session stays valid. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

interface SessionUserRow {
  id: string;
  username: string;
  created_at: number;
  expires_at: number;
}

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ id: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id, userId, now, expiresAt)
    .run();
  return { id, expiresAt };
}

export async function getSessionUser(
  db: D1Database,
  sessionId: string,
): Promise<PublicUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.created_at AS created_at,
              s.expires_at AS expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<SessionUserRow>();

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await deleteSession(db, sessionId);
    return null;
  }
  return { id: row.id, username: row.username, createdAt: row.created_at };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}
