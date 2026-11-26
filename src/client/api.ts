import type {
  AllTimeRow,
  ApiError,
  ArchiveGame,
  GameResponse,
  LeaderboardResponse,
  PublicUser,
  RaceResponse,
  RevealResult,
  SubmitResult,
  TimelineEntry,
} from "../shared/types";
import { tzOffset } from "./time";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiRequestError";
  }
}

/** Same-origin JSON client. Session auth rides on an httpOnly cookie. */
export class Api {
  constructor(private readonly base = "") {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "X-TZ-Offset": String(tzOffset()) };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(this.base + path, {
      method,
      credentials: "same-origin",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const err = (data ?? {}) as ApiError;
      const fallback =
        response.status >= 500
          ? `Server error (HTTP ${response.status}). If this is a fresh checkout, run: npm run db:migrate:local`
          : `Request failed (HTTP ${response.status})`;
      throw new ApiRequestError(
        response.status,
        err.error ?? "request_failed",
        err.message ?? fallback,
      );
    }
    return data as T;
  }

  async getSession(): Promise<PublicUser | null> {
    const { user } = await this.request<{ user: PublicUser | null }>("GET", "/api/auth/me");
    return user;
  }

  async register(username: string, password: string): Promise<PublicUser> {
    const { user } = await this.request<{ user: PublicUser }>("POST", "/api/auth/register", {
      username,
      password,
    });
    return user;
  }

  async login(username: string, password: string): Promise<PublicUser> {
    const { user } = await this.request<{ user: PublicUser }>("POST", "/api/auth/login", {
      username,
      password,
    });
    return user;
  }

  async logout(): Promise<void> {
    await this.request<{ ok: true }>("POST", "/api/auth/logout");
  }

  getTodayGame(): Promise<GameResponse> {
    return this.request<GameResponse>("GET", "/api/games/today");
  }

  getGame(id: string): Promise<GameResponse> {
    return this.request<GameResponse>("GET", `/api/games/${encodeURIComponent(id)}`);
  }

  async listGames(): Promise<ArchiveGame[]> {
    const { games } = await this.request<{ games: ArchiveGame[] }>("GET", "/api/games");
    return games;
  }

  async getRace(id: string): Promise<RaceResponse> {
    return this.request<RaceResponse>("GET", `/api/games/${encodeURIComponent(id)}/race`);
  }

  submit(id: string, words: TimelineEntry[]): Promise<SubmitResult> {
    return this.request<SubmitResult>("POST", `/api/games/${encodeURIComponent(id)}/submit`, {
      words,
    });
  }

  getGameLeaderboard(id: string): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>(
      "GET",
      `/api/games/${encodeURIComponent(id)}/leaderboard`,
    );
  }

  reveal(id: string, username: string): Promise<RevealResult> {
    return this.request<RevealResult>(
      "POST",
      `/api/games/${encodeURIComponent(id)}/reveal/${encodeURIComponent(username)}`,
    );
  }

  async getAllTime(): Promise<AllTimeRow[]> {
    const { rows } = await this.request<{ rows: AllTimeRow[] }>("GET", "/api/leaderboard/alltime");
    return rows;
  }
}
