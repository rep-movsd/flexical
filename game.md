# Wordtwist — Game Design

> Status: design spec. This describes the complete game dynamics. Implementation
> details live in the code and README; this document is the source of truth for
> *how the game behaves*.

## Overview

Wordtwist is a daily word-finding game. Each day is built from a **pair of long
seed words**. From the letters those words contain, players find as many valid
words as they can. You are not racing a pool of tiles — you are given a set of
**allowed letters** and may reuse them freely.

It is solo, asynchronous and competitive: you build a word list in one sitting,
submit it, and see how your score compares on that day's leaderboard. Past games
stay playable forever, so a dedicated player can keep grinding old boards to
climb an all-time "marathon" ranking.

## Glossary

| Term | Meaning |
|---|---|
| **Game** | One day's puzzle, defined by a pair of seed words. Identified by its UTC date. |
| **Seed words** | Two distinct English words of a fixed length (currently 6 letters). Hidden from players. |
| **Allowed letters** | The set of distinct letters appearing in either seed word. |
| **Attempt** | One run at a game: a word list the player assembles and submits. |
| **Run / Play** | The recorded result of one attempt (words, timestamps, score, badges). |
| **Reveal** | Looking at another player's words, which permanently locks the game for you. |
| **Ghost** | A replay of a top player's run, shown during your attempt in race mode. |

## The puzzle

- Each day's game is generated from **two distinct seed words** of **6 letters**,
  selected from the bundled dictionary.
- The player is shown the **allowed letters**: the set of *distinct* letters in
  either seed word. Duplicates collapse. For example, seeds `GARDEN` and `PIRATE`
  give the allowed letters `A D E G I N P R T` (9 letters, each shown once).
- Letters may be **reused any number of times**. The letters are a set of keys
  you are permitted to press, not a finite rack.
- The server **precomputes how many answers exist per word length**; each
  found-words lane shows `found / total`.
- The two seed words are **never shown**. Their **length** is shown as a target
  (currently 6 letters) — see Scoring and Badges.

### Seed selection

- Candidates are dictionary words of 6 letters.
- A pair is chosen **deterministically from the UTC date**, so every player gets
  the same game on the same day, and the game can be regenerated from the date.
- The two words are **distinct**. Recently used seeds are avoided so games do
  not repeat for a long time.
- Additional tuning (e.g. requiring the pair to expose enough vowels, or not to
  share too many letters) may be added later; it is not required by the rules.

## Playing a word

A word is **valid** if and only if all of the following hold:

1. It is **at least 4 letters** long.
2. Every letter it uses is in the **allowed letters** set (case-insensitive).
3. It appears in the **dictionary**.

Letters may repeat freely, so any word whose alphabet is a subset of the allowed
letters qualifies, regardless of how many times a letter appears.

Examples, with allowed letters `A D E G I N P R T`:

- `GARDEN` — valid (it is a seed word).
- `PIRATE` — valid (it is a seed word).
- `TIRADE` — valid.
- `TRAIN` — valid.
- `TENET` — valid: letters repeat, which is always allowed.
- `STONE` — invalid: `S` and `O` are not in the allowed set.
- `APPLE` — invalid: `L` is not allowed.

> The only reasons a word is rejected are: too short, contains a disallowed
> letter, or is not in the dictionary. Repeating a letter is never a reason to
> reject.

## Scoring

Each accepted word of length `n` scores:

```
points(n) = round(n + K^n)
```

where

```
K = L^(1/L)
L = length of the longer seed word
```

This makes longer words worth **exponentially** more, and is calibrated so that
**the longer seed word scores exactly `2 × L`**:

```
points(L) = L + K^L = L + L = 2L
```

`K` is therefore **per-game** (it depends on that day's longest seed). Points are
rounded to whole numbers.

### Worked examples

Seeds are always 6 letters, so `L = 6` and `K = 6^(1/6) ≈ 1.3480`:

| `n` | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|
| `points(n)` | 7 | 9 | **12** | 15 | 19 | 24 | 30 |

(At `n = 6` the seed word scores `2 × 6 = 12`.)

Notes:

- A word **longer** than both seeds is possible (letters repeat), and scores more
  than `2L`. Nothing special happens except the star badge (below).
- The player's score for a game is the sum of the points of the accepted words in
  their best run.

## Badges

Badges are awarded per run and shown on the leaderboard. They signal achievement
without revealing any words.

| Badge | Earned by |
|---|---|
| ☀ **Sun** | The run contains **seed word A** (the first seed). |
| 🌙 **Moon** | The run contains **seed word B** (the second seed). |
| ⭐ **Star** | The run contains a **non-seed word at least as long as the shorter seed**. |

Badges are computed by the server (it knows the seeds). The client shows them on
submitted results and on leaderboard rows.

## Daily rhythm and replays

- There is **one game per UTC day**.
- **Today's game:** a player may **submit exactly once**. After that submission
  the game is locked for them for the rest of the day; they cannot add words or
  resubmit today.
- **Past games:** every previous game remains playable. A player may replay a
  past game **any number of times**; the game keeps their **best score**.
- The intent is a marathon: the daily single shot is the headline moment, while
  past boards can be ground repeatedly to push an all-time total.

## Leaderboards

- **Per-game leaderboard:** every game (today's and each past day) has its own
  leaderboard, ranked by score, showing **points only** plus badge icons.
- **All-time board:** ranks players by the **sum of their best score on every
  game they have played** ("marathon" total). A player's best on a game is the
  highest-scoring run they have recorded for it.

## Reveal mechanic (spoilers)

- A leaderboard row shows **only the player's points and badges** by default.
- **Expanding a row reveals that player's words.**
- Doing so **permanently locks that game for you**: you can no longer submit a
  run for it, now or on any future replay. The lock applies to the current day's
  game and to every past game alike.
- This means a player must choose: play blind and keep competing, or peek and
  forfeit that board. Badges are shown *without* expanding, so you can read the
  leaderboard for achievement signals without spoiling the words.

## Race mode (ghost racing)

Race mode gives the feeling of playing alongside the best, without spoiling
anything.

- When a player starts an attempt, the **top 5 runs for that same game** (by
  score, excluding the player's own run) are replayed as **ghosts** starting at
  the player's `t = 0`.
- Ghosts use their **real recorded timing**: each run is stored with a timestamp
  for every word, so the ghost's score climbs at the same pace it actually did.
- Ghosts show **progress only** — cumulative **score and word count**, plus
  word-*length* pings ("found a 7-letter word") — and **never the words**. This
  keeps race mode free of spoilers, so it does **not** trigger the reveal lock.
- Each ghost lane shows the player's **username and badges**.
- If fewer than five runs exist, only those are shown. If none exist, the game
  shows a placeholder ("No ghosts yet — set the pace").
- Because runs are stored, race mode is always a **replay**, not a live match
  against concurrent players.

## Accounts

- An account (username + password) is required to **submit a run** and appear on
  leaderboards; it is what makes scores, bests and locks persist.
- Browsing is open to anonymous visitors, but a run cannot be recorded without
  signing in.
- The reveal lock is stored per account and per game.

## Rules summary

1. One game per UTC day, from a hidden pair of 6-letter seed words.
2. You get the distinct letters of both seeds; reuse them freely.
3. A word scores if it is ≥ 4 letters, uses only allowed letters, and is in the
   dictionary.
4. `points(n) = round(n + K^n)`, `K = L^(1/L)`; the longest seed scores `2L`.
5. Badges: ☀ seed A, 🌙 seed B, ⭐ a non-seed word ≥ the shorter seed.
6. Today: one submission. Past games: unlimited replays, best score kept.
7. Per-game boards (points + badges) and an all-time marathon board.
8. Expanding anyone's words reveals them and permanently locks that game for you.
9. Race the top 5 runs as spoiler-free, accurately-timed ghosts.

## Open questions

- Seed-selection tuning (vowel coverage, letter-set interest) — optional polish.
- Whether the all-time board should weight by number of games played or count an
  incomplete day differently.
- Whether the client's locally-recorded timestamps need server-side sanity
  limits (they are advisory; the score is what is ranked).
