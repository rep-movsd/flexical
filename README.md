# Wordtwist

Find every word you can build from a single Scrabble-style rack. One rack per
day; sign in to save stats and appear on the leaderboard.

This repository is a **working shell**: the app, auth, API, database and UI are
done; the **game logic** (rack generation, word solving, scoring) is stubbed in
`src/shared/engine/` for you to implement.

## Stack

- **UI:** Preact (class components) + `preact-router`, responsive CSS
- **API:** Hono on a Cloudflare Worker
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** username + password (PBKDF2 via WebCrypto, opaque D1-backed sessions)
- **Build:** Vite + `@cloudflare/vite-plugin` — one deploy for client + Worker
- **Tests:** Vitest

## Layout

```
index.html                 Vite entry (mounts the SPA)
words.txt                  38,888 words, 4+ letters, lowercase (the dictionary)
wrangler.jsonc             Worker + assets + D1 config
vite.config.ts             Vite + Cloudflare plugin
src/
  client/                  Preact app (class components)
    app.tsx                Root: owns Api + Store, resolves session, routing
    api.ts                 Typed fetch client
    store.ts               Observable store (session, route, viewport)
    components/            Shell/nav, Rack, WordEntry, FoundWords, ScorePanel, Timer
    screens/               GameScreen, AuthScreen, LeaderboardScreen, ProfileScreen
    styles.css             Responsive styles (mobile bottom tabs / desktop top bar)
  server/                  Cloudflare Worker (Hono)
    index.ts               App wiring and middleware
    auth/                  password hashing, sessions, middleware
    routes/                auth, puzzles, leaderboard
    db/                    data-access (repo.ts) + migrations/
    dictionary.ts          loads words.txt into a Dictionary (inlined at build)
  shared/                  Used by both client and Worker
    types.ts               API/domain types
    engine/                >>> THE GAME LOGIC YOU WRITE <<<
      rack.ts              rack type, generateRack(), canBuild()
      dictionary.ts        Dictionary + parsers
      solver.ts            solveRack()
      scoring.ts           Rules, scoreWord(), classifySubmission()
      engine.test.ts       contract tests for the above
```

## Run it locally

```bash
npm install
npm run db:migrate:local     # create local D1 tables
npm run dev                  # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck            # tsc across client, worker and config
npm test                     # vitest (game-engine contract tests)
npm run build                # emits dist/client + dist/wordtwist
```

## Where the game logic lives

Everything you implement is in `src/shared/engine/` and imported by the Worker.
Each function has a titled `TODO(game logic)` comment describing what it must do:

| Function | File | Responsibility |
|---|---|---|
| `generateRack()` | `rack.ts` | Pick the letters for a puzzle (weighted draw; ensure playability). |
| `solveRack()` | `solver.ts` | All valid words buildable from a rack. Brute force or prefix trie. |
| `scoreWord()` | `scoring.ts` | Points for one word. |
| `classifySubmission()` | `scoring.ts` | Accept/reject submitted words and update the score. |

`canBuild()`, `createDictionary()` and `parseDictionary()` are already implemented
as helpers. The contract tests in `engine.test.ts` pass today and should keep
passing.

### Why the Worker solves the rack

The Worker generates the rack **and** computes the answer set when a puzzle is
first requested, then stores the solution in D1. The client only ever sees the
letters. Submissions are checked server-side, so the leaderboard can be trusted
and the answers never ship to the browser.

## Authentication

Username + password only (no email, so no password reset by design).

- `POST /api/auth/register` `{ username, password }`
- `POST /api/auth/login` `{ username, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Passwords are hashed with PBKDF2-SHA256 (100k iterations, random per-user salt);
only the salt/hash/iterations are stored. Sessions are random ids stored in D1
and delivered as an `httpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS).

To add OAuth later, add nullable `provider` / `provider_id` columns and a unique
index to `users` — the schema comment in `0001_init.sql` notes this.

## Game API

- `GET  /api/puzzles/today` → `{ puzzle: { id, letters, maxScore } }`
- `GET  /api/puzzles/:id`
- `POST /api/puzzles/:id/submit` `{ words: string[] }` → `SubmitResult`
- `GET  /api/leaderboard/today`

Anonymous players can play and submit words (nothing is persisted). Signed-in
players are recorded in `plays` and ranked.

## Data model

`users`, `sessions`, `puzzles`, `plays`, `leagues`, `league_members`. See
`src/server/db/migrations/0001_init.sql`. Leagues are scaffolded but have no
routes yet — a leaderboard is `plays` joined to `users` ordered by score.

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
