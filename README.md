# Flexical

A daily word game. Each day hides **one seed word** (8–10 letters). You're given
the **distinct letters** inside it — and you may reuse each letter as often as
you like — so your job is to find as many real words as you can and score as
high as possible. Longer words are worth exponentially more, and the seed word
itself is the jackpot.

Quick to learn, hard to master. Runs in the browser on phone and desktop.
Currently an early prototype.

> Full game design: [`game.md`](./game.md). Implementation plan:
> [`PLAN.md`](./PLAN.md). Orientation for a new contributor (or LLM): the game
> rules, architecture and conventions live in [`context.md`](./context.md).

## How a game works

- A **game** = one calendar date (in the viewer's local timezone), defined by a
  hidden single **seed word** of 8–10 letters chosen deterministically from the
  date.
- **Allowed letters** = the set of *distinct* letters in the seed word. Letters
  may be **reused any number of times** — they're a set of keys, not a finite
  rack.
- A word scores if it is **≥ 4 letters**, uses **only allowed letters**, and is
  in the dictionary.
- **Scoring:** `points(n) = round(n + K^n)`, where `K = L^(1/L)` and `L` is the
  seed length. This makes the seed word score exactly `2L` and longer words worth
  exponentially more.
- **Badges:** ☀ found the seed word; ⭐ found a non-seed word at least as long as
  the seed. (🌙, the second-seed badge, is currently disabled — see below.)
- The server **precomputes how many answers exist per word length**; each
  found-words lane shows `found / total`.
- **Today's game:** one submission. **Past games:** replayable without limit,
  keeping your best score. Each game has a leaderboard; the all-time "marathon"
  board sums your best score on every game.
- **Revealing** another player's words (from a leaderboard) permanently locks
  that game for you.
- **Race mode** replays the top 5 runs for a game as spoiler-free, accurately
  timed ghosts (score and word count only, never the words).
- **Get-ready overlay:** before play begins, a short countdown blurs the board so
  nobody sees the letters early (Enter or the Start button begins).

## Stack

- **UI:** Preact (class components, no hooks) + `preact-router`, hand-written CSS
- **API:** Hono on a Cloudflare Worker
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** username + password (PBKDF2 via WebCrypto, opaque D1-backed sessions)
- **Build:** Vite + `@cloudflare/vite-plugin` — one deploy serves client + Worker
- **Tests:** Vitest (pure engine logic)

## Project layout

```
index.html                  Vite entry (mounts the SPA)
public/words.txt            38,888 words, 4+ letters, lowercase (the dictionary)
public/_headers             cache headers for /words.txt
wrangler.jsonc              Worker + static assets + D1 config
vite.config.ts              Vite + Cloudflare plugin
vitest.config.ts            Vitest (engine tests only)
game.md / PLAN.md / context.md  docs
scripts/deploy.sh           one-command deploy
src/
  client/                   Preact app (class components)
    app.tsx                 Root: owns Api + Store, resolves session, routing
    api.ts                  Typed fetch client (sends X-TZ-Offset)
    dictionary.ts           loads /words.txt for local validation
    store.ts                observable store (session, route, viewport)
    context.ts              AppContext (api + store injection)
    time.ts                 viewer-local date helpers
    components/             Shell, Letters, WordEntry, FoundWords, ScorePanel,
                            RacePanel, BadgeIcons, Timer
    screens/                GameScreen, ArchiveScreen, LeaderboardScreen,
                            AllTimeScreen, AuthScreen, ProfileScreen, NotFound
    styles.css              responsive styles
  server/                   Cloudflare Worker (Hono)
    index.ts                app wiring + middleware
    time.ts                 viewer-local date from X-TZ-Offset
    games.ts                deterministic game generation + answer counts
    dictionary.ts           loads public/words.txt (inlined at build)
    auth/                   password hashing, sessions, middleware
    routes/                 auth, games, leaderboard
    db/                     repo.ts (data access) + migrations/
  shared/                   Used by BOTH client and Worker
    types.ts                API/domain types
    password.ts             password policy (shared validation)
    engine/                 pure game logic (see below)
```

## Shared engine (`src/shared/engine/`)

Pure TypeScript, no I/O, no framework — safe on both the client and the Worker.

| File | Responsibility |
|---|---|
| `letters.ts` | `allowedLetters`, `toLetterSet`, `normalizeWord`, `isBuildable` |
| `scoring.ts` | `MIN_WORD_LENGTH`, `computeK`, `pointsForLength`, `scoreWords` |
| `badges.ts` | `computeBadgeWords`, `computeBadges`, `wordMarks` (moon disabled) |
| `seeds.ts` | `pickSeed` — deterministic, date-seeded single seed word |
| `validation.ts` | `classifyWords` — server-side word classification |
| `timeline.ts` | ghost replay helpers |
| `answers.ts` | `countAnswersByLength` — per-length answer counts |
| `dictionary.ts` | `Dictionary` interface + parsers |

## Getting started

```bash
npm install
npm run db:migrate:local     # create local D1 tables (Wrangler uses local SQLite)
npm run dev                  # http://localhost:5173
```

If you change the schema, or pull a change that did, reset the local database:

```bash
npm run db:reset:local       # wipe + recreate local D1 tables
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server; the Worker runs in workerd |
| `npm run build` | Emits `dist/client` (SPA) + `dist/flexical` (Worker) |
| `npm run preview` | Build, then preview the built Worker locally |
| `npm run deploy` | Build + migrate + deploy (see Deployment) |
| `npm run typecheck` | `tsc` across client, worker and config |
| `npm test` | Vitest (engine contract tests) |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations |
| `npm run db:reset:local` | Wipe + recreate the local database |
| `npm run cf-typegen` | `wrangler types` (regenerate binding types) |

## Auth

Username + password only (no email, so no password reset by design).

- `POST /api/auth/register` `{ username, password }`
- `POST /api/auth/login` `{ username, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Password policy: **≥ 6 characters, including a letter and a number** (symbols
allowed). Passwords are hashed with PBKDF2-SHA256 (100k iterations, random
per-user salt); only the salt/hash/iterations are stored. Sessions are random ids
stored in D1 and delivered as an `httpOnly`, `SameSite=Lax` cookie
(`fx_session`; `Secure` over HTTPS).

## API

All requests may send `X-TZ-Offset` (minutes) so the server can pick the viewer's
local day.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/games/today` | `{ game, me }` |
| GET | `/api/games` | archive list |
| GET | `/api/games/:id` | `{ game, me }` |
| GET | `/api/games/:id/race` | top-5 ghosts (no words) |
| POST | `/api/games/:id/check` | `{ words }` → live badge marks |
| POST | `/api/games/:id/submit` | `{ words:[{word,t}] }` (auth) → result |
| GET | `/api/games/:id/leaderboard` | points + badges |
| POST | `/api/games/:id/reveal/:username` | their words + records your lock (auth) |
| GET | `/api/leaderboard/alltime` | marathon totals |

`me` on the game endpoints is `{ played, revealed, locked, bestScore, words,
timeline, badges, badgeWords }` or `null` for anonymous visitors.

## Data model (`src/server/db/migrations/`)

- **users** — id, username, username_lower (unique), salt, hash, iterations, created_at
- **sessions** — id, user_id, created_at, expires_at
- **games** — id/date, seed_a, seed_b (empty for single-seed games), letters,
  longest/shortest seed length, answer_counts_json, created_at
- **plays** — (user_id, game_id) PK, words_json (timeline), score, words_found,
  duration_ms, finished_at
- **reveals** — (user_id, game_id) PK, revealed_at

Migrations are applied with `wrangler d1 migrations apply` (tracked in
`d1_migrations`), so new columns can be added without wiping data.

## Deployment

One command does everything:

```bash
npm run deploy
```

`scripts/deploy.sh` is idempotent:

- **First run:** authenticates (`wrangler login` opens a browser), creates the
  `flexical` D1 database, writes its id into `wrangler.jsonc`, applies the
  migrations, builds and deploys.
- **Every later run (after code changes):** applies any new migrations, rebuilds
  and redeploys. Nothing to copy or configure by hand.
- In CI, set `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID`) to skip login.

It prints the shareable link: `https://flexical.<your-subdomain>.workers.dev`
(add a custom domain later — still free). One Worker serves both the SPA and the
API, so there is no CORS to configure.

Free-tier fit: Workers requests (100k/day), Static Assets (unmetered), D1
(5 GB, 5M reads/day, 100k writes/day). The Worker bundle is ~150 kB gzipped,
including the inlined dictionary.

## Notes

- 🌙 **Moon is disabled.** Games currently use a single seed word, so the
  second-seed badge is commented out (not deleted) in
  `src/shared/engine/badges.ts`. Re-enable it if games go back to a seed *pair*.
- The dictionary (`public/words.txt`) is filtered to 4+ letter, purely
  alphabetical words. It is both inlined into the Worker (authoritative checks)
  and served statically (client-side instant feedback).
- The server is always the source of truth for scores; the client's local
  validation is only for UX.
