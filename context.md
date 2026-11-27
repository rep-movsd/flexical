# Flexical — Context

This file orients a new contributor (human or LLM) quickly. Read it first, then
`game.md` for the full rules. It is deliberately high-level; details live in code
comments.

## What this is

A daily word game. Each day has **one hidden seed word** (8–10 letters). The
player is shown the **distinct letters** in that seed and may reuse each letter
freely; they find as many valid words as they can, scoring exponentially more for
longer words. Today's game has a single **3-minute timed attempt** (your **hare**
score); after the clock — and on any past game — you keep playing untimed (your
**tortoise** total). Words auto-save, and the only way a game locks is by peeking at
someone else's answers. There's an all-time leaderboard.

## Architecture in one picture

```
Browser (Preact SPA, class components)
  │  fetch /api/*  (same origin, cookie auth)
  ▼
Cloudflare Worker (Hono)  ──  D1 (SQLite): users, sessions, games, plays, reveals
  │                         └─ words.txt inlined for authoritative word checks
  └─ serves the built SPA + public/words.txt as static assets
```

One deployable unit: Vite builds the SPA and the Worker; the Worker serves both.
No separate API host, no CORS.

## The game in one paragraph

`games` are keyed by a calendar date, fixed to **IST (UTC+5:30)** — a new game at
00:00 IST. A game's seed word is generated **deterministically from the date** (so
everyone gets the same game). Allowed letters = the seed's distinct letters. A word
scores if it's ≥ 4 letters, uses only allowed letters, and is in the dictionary:
`points(n) = round(n + K^n)` with `K = L^(1/L)` (`L` = seed length), so the seed
scores `2L`. Badges: ☀ = found the seed word, ⭐ = a non-seed word at least as long
as the seed. Today's game has one **3-minute timed attempt** (the **hare** score,
tracked locally in the browser); afterwards and on past games you keep playing
untimed (the **tortoise** total). Words auto-save. Looking at someone's words locks
that game for you.

## Request lifecycle (the important flows)

1. **Load a game** — `GET /api/games/today` (or `/:id`). The Worker ensures the
   game exists (`ensureGame`), which picks the seed, computes allowed letters and
   precomputes per-length answer counts. It returns `{ game, me }`; `me` carries
   the player's run, badges, and lock state.
2. **Local validation** — the client fetches `/words.txt` once, builds a `Set`,
   and checks each typed word instantly (length, allowed letters, dictionary).
   This is UX only.
3. **Auto-save** — as words are found, the client (debounced) posts its full word
   set to `POST /api/games/:id/words`. The Worker re-validates, unions it with the
   stored run, rescores, and returns badge marks. For anonymous players it still
   validates/returns marks but stores nothing. A game stays open; the only lock
   is if you've peeked at another player (once `REVEAL_LOCKS` is on).
4. **Peek** — `POST /api/games/:id/peek/:username` returns that player's words.
   While `REVEAL_LOCKS` is off (current default) it records no lock; when on, it
   writes a `reveals` row and locks the game for the requester.

Boards: **Archive** (`/archive/:date`) shows a date's top 10 (+ your row) with a
peek modal; **Leaderboard** (`/leaderboard`) is the all-time totals board
(sortable by points/games/avg); **Opponents** (`/opponents`) looks up one
player's daily scores.

## Key invariants & gotchas

- **Server is authoritative.** The client's local dictionary/score are for
  feedback only. Never trust the client for scoring or validation.
- **Letters are reusable.** `isBuildable` is a *subset check*, not letter
  counting.
- **Local-timezone days.** The client sends `X-TZ-Offset`; the server derives the
  viewer's local date (`src/server/time.ts`). "Today" differs per viewer; a game
  id *is* a `YYYY-MM-DD` string.
- **Single seed.** A game is built from one seed word; `games.seed_b` is stored
  empty and unused. Badges and the ⭐ threshold use only `seed_a` (see
  `badges.ts`).
- **Badge words, not just booleans.** The server returns *which* word earned each
  badge (`badgeWords`) so the client can mark specific found words; the `words`
  auto-save response carries the same info.
- **Hare vs tortoise.** Today's game has one local 3-minute timed attempt (the hare
  score, boundary stored as `plays.hare_count`); everything after — and all past
  games — is untimed (the tortoise total). The timer is client-side; the server just
  records the boundary.
- **Runs are just word sets.** `plays.words_json` is a plain `["stone", …]` in
  find order (the reader tolerates the old `[{word,t}]` shape). No timestamps.
- **Saves are debounced** (≈1s) and flushed on page hide. Writes are the scaling
  pressure point — see the README/PR notes; batch, don't write per keystroke.
- **Peek locking is off during testing.** `REVEAL_LOCKS` in `src/server/config.ts`
  is `false`, so peeking returns words without recording a lock. Flip it (with a
  fresh DB) before launch.
- **Games are bounded by date.** Any date has a game (the seed is a hash of the
  date), but requests are restricted to `MIN_GAME_DATE` (`2026-01-01`) → today.
- **Answer counts are precomputed** at game creation into
  `games.answer_counts_json`; backfilled lazily for older games. They power the
  `found / total` display.
- **Dictionary is 4+ letters, lowercase, purely alphabetical.** It's inlined into
  the Worker (`import ... '?raw'`) and also served at `/words.txt`.

## Conventions

- **Preact class components only** (no hooks in app code). State via
  `this.state`/`setState`; shared app state via the `Store` class + `AppContext`.
- **Respect the split:** pure logic lives in `src/shared/engine` (no I/O, no
  framework, unit-tested). Suffix/side-specific code lives in `src/client` or
  `src/server`. Anything imported by both must stay environment-agnostic.
- **Data access** goes through `src/server/db/repo.ts`; routes read like game
  logic.
- Keep the `game.md` spec and the code in sync — it's the source of truth for
  behaviour.

### UI names

Shared vocabulary for the UI:

- **top bar** — the sticky header (brand, **nav**, account button).
- **board** — the centered column on the Play screen.
- **letter box** — the board's top panel: the **letter keys**, the **word input**,
  the **shuffle button**, and (today) the **timer** + **pause button**.
- **hare overlay** — the full-screen modal for the timed attempt: **Start**,
  **Paused**, and **Time's up** (which shows the hare score).
- **found box** — the board's bottom panel: the **stats line** ("N points · Found
  M/N") and a **view switcher** (Words · Stats · Help).
- **Archive** — a **date bar** (date + picker + Play) and a **day board** with a
  **Hares / Tortoises** toggle; a row's **peek button** opens the **peek dialog** then
  the **words dialog**.
- **Leaderboard** — the **all-time board** (Hares / Tortoises toggle, sortable columns).
- **Opponents** — a **player lookup** and a **score history** (hare + total per day).

Badges are **☀ Sun** (found the seed word) and **⭐ Star** (a non-seed word at least
as long as the seed). There is no submit button: scoring is automatic and words
auto-save.

## Where to change what

- **Rules / scoring / badges / seed choice** → `src/shared/engine/*` (+ tests).
- **Making a new day's game** → `src/server/games.ts` (`ensureGame`).
- **New API endpoint** → `src/server/routes/*` and mount in `src/server/index.ts`.
- **Schema change** → add a new file in `src/server/db/migrations/` (never edit an
  applied one) and update `repo.ts`.
- **UI** → `src/client/screens/*` and `src/client/components/*`.
- **Game design text** → `game.md`.

## Run, test, verify

```bash
npm install
npm run db:migrate:local     # or db:reset:local after a schema change
npm run dev                  # http://localhost:5173
npm run typecheck && npm test && npm run build
npm run deploy               # one-command deploy (see README)
```

When changing the engine, update `src/shared/engine/engine.test.ts`. When
changing behaviour, do a quick browser pass: type a valid/invalid word, confirm
it appears and auto-saves (reload to check), toggle the found-box views, and
confirm the peek lock triggers.

## Open items / TODO

- Seed-selection tuning (vowel coverage / letter-set interest).
- All-time board weighting by number of games played.
- Scaling: batch auto-saves and materialize the all-time totals before the
  `plays` table gets large (see README "scaling" notes).
- Optional: GitHub Actions workflow to auto-deploy on push (uses
  `CLOUDFLARE_API_TOKEN`).
