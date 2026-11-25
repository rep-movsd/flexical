import type {
  ApiError,
  LeaderboardRow,
  PublicUser,
  RackView,
  SubmitResult,
} from "../shared/types";

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
    const res = await fetch(this.base + path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      const err = (data ?? {}) as ApiError;
      throw new ApiRequestError(res.status, err.error ?? "request_failed", err.message);
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

  async getTodayPuzzle(): Promise<RackView> {
    const { puzzle } = await this.request<{ puzzle: RackView }>("GET", "/api/puzzles/today");
    return puzzle;
  }

  submitWords(puzzleId: string, words: string[]): Promise<SubmitResult> {
    return this.request<SubmitResult>(
      "POST",
      `/api/puzzles/${encodeURIComponent(puzzleId)}/submit`,
      { words },
    );
  }

  async getTodayLeaderboard(): Promise<LeaderboardRow[]> {
    const { rows } = await this.request<{ id: string; rows: LeaderboardRow[] }>(
      "GET",
      "/api/leaderboard/today",
    );
    return rows;
  }
}
