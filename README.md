# Wordtwist

A daily word game. Each day is built from a hidden pair of long **seed words**;
you are given the set of letters they contain (reuse them freely) and race to
find high-scoring words. Sign in to save runs, climb each day's leaderboard, and
grind past games toward an all-time marathon ranking.

Full rules live in [`game.md`](./game.md). The build plan is in
[`PLAN.md`](./PLAN.md).

## Stack

- **UI:** Preact (class components) + `preact-router`, responsive CSS
- **API:** Hono on a Cloudflare Worker
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** username + password (PBKDF2 via WebCrypto, opaque D1 sessions)
- **Build:** Vite + `@cloudflare/vite-plugin` — one deploy for client + Worker
- **Tests:** Vitest

## Layout

```
index.html                 Vite entry (mounts the SPA)
public/words.txt           38,888 words, 4+ letters, lowercase (the dictionary)
public/_headers            cache headers for /words.txt
wrangler.jsonc             Worker + assets + D1 config
vite.config.ts             Vite + Cloudflare plugin
game.md                    the game design / rules
PLAN.md                    implementation plan
src/
  client/                  Preact app (class components)
    app.tsx                Root: owns Api + Store, resolves session, routing
    api.ts                 Typed fetch client (sends X-TZ-Offset)
    dictionary.ts          loads /words.txt for local validation
    store.ts / context.ts  observable store + injection
    components/            Shell/nav, Letters, WordEntry, RacePanel, FoundWords,
                           ScorePanel, BadgeIcons, Timer
    screens/               GameScreen, ArchiveScreen, LeaderboardScreen,
                           AllTimeScreen, AuthScreen, ProfileScreen
    styles.css             responsive styles (mobile tabs / desktop top bar)
  server/                  Cloudflare Worker (Hono)
    index.ts               App wiring and middleware
    time.ts                viewer-local date from X-TZ-Offset
    games.ts               deterministic game generation
    auth/                  password hashing, sessions, middleware
    routes/                auth, games, leaderboard
    db/                    data-access (repo.ts) + migrations/
    dictionary.ts          loads public/words.txt into a Dictionary (inlined)
  shared/                  Used by both client and Worker
    types.ts               API/domain types
    engine/                pure game logic
      letters.ts           allowed-letters set + buildability
      scoring.ts           points(n) = round(n + K^n), K = L^(1/L)
      badges.ts            sun / moon / star
      seeds.ts             deterministic daily seed pair
      validation.ts        server-side word classification
      timeline.ts          ghost replay helpers
      engine.test.ts       contract tests
```

## Run it locally

```bash
npm install
npm run db:migrate:local     # create local D1 tables
npm run dev                  # http://localhost:5173
```

If you changed the schema (or pulled a change that did), reset the local database:

```bash
npm run db:reset:local       # wipe + recreate local D1 tables
```

Other scripts:

```bash
npm run typecheck            # tsc across client, worker and config
npm test                     # vitest (game-engine contract tests)
npm run build                # emits dist/client + dist/wordtwist
```

## How a game works

- A **game** = one calendar date (in the viewer's local timezone), defined by a
  hidden pair of 8–10 letter seed words.
- **Allowed letters** = the distinct letters of both seeds. Letters may be reused
  any number of times.
- A word scores if it is **≥ 4 letters**, uses **only allowed letters**, and is in
  the dictionary.
- Points: `round(n + K^n)` with `K = L^(1/L)` (`L` = longer seed length), so the
  longest seed word scores `2L`.
- Badges: ☀ found seed A, 🌙 found seed B, ⭐ a non-seed word at least as long as
  the shorter seed.
- **Today's game** allows **one submission**. **Past games** can be replayed
  without limit, keeping your best score. Each game has a leaderboard; the
  all-time "marathon" board sums your best score on every game.
- **Revealing** another player's words (from a leaderboard) permanently locks
  that game for you.
- **Race mode** replays the top 5 runs for a game as spoiler-free, accurately
  timed ghosts (score and word count only, never the words).

## Auth

Username + password only (no email, so no password reset by design).

- `POST /api/auth/register` `{ username, password }`
- `POST /api/auth/login` `{ username, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Passwords are hashed with PBKDF2-SHA256 (100k iterations, random per-user salt).
Sessions are random ids stored in D1 and delivered as an `httpOnly`,
`SameSite=Lax` cookie (`Secure` over HTTPS).

## API

All requests may send `X-TZ-Offset` (minutes) to select the viewer's local day.

- `GET  /api/games/today` → `{ game, me }`
- `GET  /api/games` → archive list
- `GET  /api/games/:id` → `{ game, me }`
- `GET  /api/games/:id/race` → top-5 ghosts (no words)
- `POST /api/games/:id/submit` `{ words:[{word,t}] }` (auth) → result
- `GET  /api/games/:id/leaderboard`
- `POST /api/games/:id/reveal/:username` (auth) → their words + records your lock
- `GET  /api/leaderboard/alltime`

## Deploy to Cloudflare (free tier)

1. `npx wrangler login`
2. `npx wrangler d1 create wordtwist`
3. Copy the returned `database_id` into `wrangler.jsonc`
4. `npm run db:migrate:remote`
5. `npm run deploy`

This gives `https://wordtwist.<your-subdomain>.workers.dev` (add a custom domain
later — still free). One Worker serves both the SPA and the API, so there is no
CORS to configure.

Free-tier fit: Workers requests (100k/day), Static Assets (unmetered), D1
(5 GB, 5M reads/day, 100k writes/day). The Worker bundle is ~150 kB gzipped,
including the inlined dictionary.
