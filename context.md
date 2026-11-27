# Flexical — Context

This file orients a new contributor (human or LLM) quickly. Read it first, then
`game.md` for the full rules. It is deliberately high-level; details live in code
comments.

## What this is

A daily word game. Each day has **one hidden seed word** (8–10 letters). The
player is shown the **distinct letters** in that seed and may reuse each letter
freely; they find as many valid words as they can, scoring exponentially more for
longer words. It's an untimed "find them all" puzzle: a game stays open forever,
your words auto-save as you go, and the only way it locks is by revealing someone
else's answers. There's an all-time marathon board.

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

`games` are keyed by a calendar date (in the viewer's local timezone). A game's
seed word is generated **deterministically from the date** (so everyone on that
date gets the same game). Allowed letters = the seed's distinct letters. A word
scores if it's ≥ 4 letters, uses only allowed letters, and is in the dictionary:
`points(n) = round(n + K^n)` with `K = L^(1/L)` (`L` = seed length), so the seed
scores `2L`. Badges: ☀ = found the seed, ⭐ = a non-seed word ≥ seed length
(🌙 is disabled). There is no clock and no one-shot submission: a game is open
forever and a signed-in player's words auto-save as they find them (the stored
run is the union of everything found so far). Looking at someone's words locks
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
   is `403` if you revealed.
4. **Reveal** — `POST /api/games/:id/reveal/:username` returns that player's
   words and records a `reveals` row for the requester, locking the game.

## Key invariants & gotchas

- **Server is authoritative.** The client's local dictionary/score are for
  feedback only. Never trust the client for scoring or validation.
- **Letters are reusable.** `isBuildable` is a *subset check*, not letter
  counting.
- **Local-timezone days.** The client sends `X-TZ-Offset`; the server derives the
  viewer's local date (`src/server/time.ts`). "Today" differs per viewer; a game
  id *is* a `YYYY-MM-DD` string.
- **Single seed.** `games.seed_b` is stored as `""`. Any code that reads seeds
  must tolerate a missing second seed — notably the star threshold must fall back
  to the single seed's length (see `badges.ts`).
- **🌙 Moon is disabled, not deleted.** The second-seed logic is *commented out*
  in `badges.ts`. `Badges.moon` is always `false`; `BadgeIcons` still knows how
  to render it.
- **Badge words, not just booleans.** The server returns *which* word earned each
  badge (`badgeWords`) so the client can mark specific found words; the `words`
  auto-save response carries the same info.
- **No timer & no race.** There is no clock, no countdown overlay, and no ghost
  replay. A game never "closes"; words only ever accumulate.
- **Runs are just word sets.** `plays.words_json` is a plain `["stone", …]` in
  find order (the reader tolerates the old `[{word,t}]` shape). No timestamps.
- **Saves are debounced** (≈1s) and flushed on page hide. Writes are the scaling
  pressure point — see the README/PR notes; batch, don't write per keystroke.
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

Shared vocabulary for the game board (top to bottom):

- **word box** — the top panel: the allowed-letter keys and the word input.
- **found words panel** — below the word box: total points, "Found M/N", and a
  body that toggles between a chronological word log and per-length counts.

There is no **score box** or submit button: scoring is automatic, and the running
total lives in the found words panel header. Words auto-save; nothing to press.

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
it appears and auto-saves (reload to check), toggle the found-words views, and
confirm the reveal lock triggers.

## Open items / TODO

- 🌙 Moon badge re-enable if games return to a seed pair.
- Seed-selection tuning (vowel coverage / letter-set interest).
- All-time board weighting by number of games played.
- Scaling: batch auto-saves and materialize the all-time totals before the
  `plays` table gets large (see README "scaling" notes).
- Optional: GitHub Actions workflow to auto-deploy on push (uses
  `CLOUDFLARE_API_TOKEN`).
