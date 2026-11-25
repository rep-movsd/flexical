import type { PublicUser } from "../shared/types";

/** Bindings available to the Worker. `DB` is the D1 database (see wrangler.jsonc). */
export interface Env {
  DB: D1Database;
}

/** Per-request values set by middleware. */
export interface Variables {
  user: PublicUser | null;
}

export type AppEnv = { Bindings: Env; Variables: Variables };
