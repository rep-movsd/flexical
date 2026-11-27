# Flexical — Implementation Plan

Companion to `game.md` (the behavioural spec). This file describes how the app
is built. See `game.md` for the rules themselves.

> **Historical.** This plan describes an earlier design (a timed daily game with
> one-shot submissions, ghost races and per-word timestamps). The app has since
> been simplified — see `README.md` and `context.md` for the current shape. Kept
> for reference.

## Decisions

- One Cloudflare Worker serves the SPA + API; D1 for storage (single deploy).
- Preact, **class components** only; routing via `preact-router`.
- Auth: username + password (PBKDF2 via WebCrypto), opaque D1 sessions.
- Client holds a local copy of the dictionary for instant feedback; the server
  re-validates every submission and owns the score.
- **Local-timezone day boundary**: the client sends `X-TZ-Offset`; the server
  derives the viewer's local date, which selects "today's" game.
- Rewrite `0001_init.sql` to the final schema (nothing deployed yet).
- Engine tests unit-level; verify the Worker with a live workerd smoke test.

## Schema — rewrite `src/server/db/migrations/0001_init.sql`

```sql
users(id, username, username_lower UNIQUE, salt, hash, iterations, created_at)
sessions(id, user_id, created_at, expires_at)

games(id TEXT PK,               -- "YYYY-MM-DD"
      date TEXT UNIQUE, seed_a, seed_b,
      letters TEXT,             -- sorted distinct allowed letters, e.g. "AEIMNORSTU"
      longest_seed_length INT, shortest_seed_length INT, created_at INT)

plays(user_id, game_id, words_json,   -- [{"word":"stone","t":1234}]
      score INT, words_found INT, duration_ms INT, finished_at INT,
      PRIMARY KEY(user_id, game_id))
  INDEX (game_id, score DESC), INDEX (user_id)

reveals(user_id, game_id, revealed_at, PRIMARY KEY(user_id, game_id))
```

## Shared engine — `src/shared/engine/`

| Module | Contents |
|---|---|
| `letters.ts` | `allowedLetters(seedA,seedB)`, `toLetterSet`, `normalizeWord`, `isBuildable` |
| `scoring.ts` | `MIN_WORD_LENGTH`, `computeK(longest)`, `pointsForLength(n,k)`, `scoreWords` |
| `badges.ts` | `computeBadges(words, seedA, seedB)` → `{sun,moon,star}` |
| `seeds.ts` | `pickSeeds(dateKey, dict, avoid)`, deterministic (FNV hash → mulberry32) |
| `validation.ts` | `classifyWords(submitted, allowedSet, dict, k)` → `{accepted,rejected,score}` |
| `timeline.ts` | `progressAt(timeline, t)` for ghosts; `TimelineEntry`, `GhostWord` |

Delete `rack.ts`, `solver.ts`. Rewrite `engine.test.ts`.

`points(L) = round(L + K^L) = 2L` where `K = L^(1/L)` — a seed scores `2L`.

## Server — `src/server/`

| File | Contents |
|---|---|
| `time.ts` | `localDate(offset, now)`, `utcDate`, `parseOffset(header)` |
| `games.ts` | `ensureGame(db, date)` — deterministic seeds, avoids recent pairs |
| `db/repo.ts` | game/play/reveal/all-time access; `insertPlay`, `upsertBestPlay`, `topRuns`, `allTime`, `listGames`, `insertReveal`, `hasRevealed`, `getUserByUsername` |
| `routes/games.ts` | today/list/get/race/submit/reveal/leaderboard |
| `routes/leaderboard.ts` | `GET /api/leaderboard/alltime` |
| `dictionary.ts` | unchanged (inline `words.txt`) |

### Endpoints

- `GET /api/games/today` (tz) → `{ game:{id,date,letters,longestSeedLength,shortestSeedLength,k}, me }`
- `GET /api/games` (tz) → archive `[{id,date,bestScore,revealed,locked}]`
- `GET /api/games/:id` → `{ game, me }`
- `GET /api/games/:id/race` → `{ ghosts:[{username,score,wordsFound,badges,timeline:[{len,points,t}]}] }` (no words)
- `POST /api/games/:id/submit` `{words:[{word,t}]}` (tz, auth) → `{accepted,rejected,score,badges,bestScore,words,locked}`; today = single (idempotent), past = best-kept; 403 if revealed
- `POST /api/games/:id/reveal/:username` (auth) → their words + records your lock
- `GET /api/games/:id/leaderboard` → `[{rank,username,score,badges}]`
- `GET /api/leaderboard/alltime` → `[{rank,username,total,words?}]`

`me` = `{ played, revealed, locked, bestScore, words, badges, timeline }` or null.

`locked = revealed || (id === localToday && played)`.

## Client — `src/client/`

- Move `words.txt` → `public/words.txt`; add `public/_headers` caching it.
- `dictionary.ts` (fetch `/words.txt` once → `Set`), `time.ts` (`local date`, `tzOffset`).
- `api.ts` sends `X-TZ-Offset` on every request; new methods.
- Components: `Letters` (keys grid), `RacePanel` (class, ~250 ms ticker), `FoundWords`, `ScorePanel`, `WordEntry`, `Timer`.
- Screens: `GameScreen` (`/` and `/play/:date`), `ArchiveScreen`, `LeaderboardScreen` (`/board/:date?`), `AllTimeScreen`, `AuthScreen`, `ProfileScreen`, `NotFound`.
- Nav: Play / Archive / Boards.

`GameScreen` starts `t = 0` on load, validates locally, scores live, submits once
(today) or offers "New attempt" (past). Ghosts hydrate from `/race`.

## Docs & config

- `README.md`: update rules/auth/API/deploy; link `game.md`.
- `wrangler.jsonc`: unchanged (`run_worker_first: ["/api/*"]`).

## Verification

`npm run typecheck`, `npm test`, `npm run build`, then a live workerd smoke test:
today game, submit-once + lock, idempotent resubmit, past-game best-kept, race
endpoint, reveal lock, all-time board.

## Work order

schema+repo → engine+tests → server routes+time → `words.txt`/client assets →
client dictionary/api/store → client UI+CSS → docs → verify.

## Open items (non-blocking)

- Seed-selection tuning (vowel coverage / letter-set interest).
- All-time weighting by games played.
- Timestamp sanity clamps for ghosts.
