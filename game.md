# Flexical — Game Design

> Status: design spec. This describes the complete game dynamics. Implementation
> details live in the code and README; this document is the source of truth for
> *how the game behaves*.

## Overview

Flexical is a daily word-finding game. Each day is built from a hidden **seed
word** of 8–10 letters. From the letters it contains, players find as many valid
words as they can. You are not racing a pool of tiles — you are given a set of
**allowed letters** and may reuse them freely.

It is solo and asynchronous. **Today's game** gives you a single **3-minute timed
attempt** (your **hare** score); after the clock runs out — or on any past day —
you keep playing untimed (your **tortoise** total). Your words save as you go, and a
game never closes. Peeking at another player's words locks that game for you, so a
dedicated player can keep grinding old boards to climb the all-time ranking.

## Glossary

| Term | Meaning |
|---|---|
| **Game** | One day's puzzle, defined by a seed word. Identified by its date. |
| **Seed word** | A single English word of 8–10 letters. Hidden from players. |
| **Allowed letters** | The set of distinct letters appearing in the seed word. |
| **Run / Play** | A player's record for a game: every word they have found so far. It only ever grows. |
| **Hare** | The timed score: the words found during today's one 3-minute attempt. |
| **Tortoise** | The untimed total: every word found for a game, ever. |
| **Game day** | Fixed to IST (UTC+5:30); a new game arrives at 00:00 IST. |
| **Peek** | Looking at another player's words, which permanently locks the game for you. |

## The puzzle

- Each day's game is generated from a **single seed word** of **8–10 letters**,
  selected from the bundled dictionary.
- The player is shown the **allowed letters**: the set of *distinct* letters in
  the seed word. Duplicates collapse. For example, the seed `MOUNTAIN` gives the
  allowed letters `A I M N O T U` (7 letters, each shown once).
- Letters may be **reused any number of times**. The letters are a set of keys
  you are permitted to press, not a finite rack.
- The server **precomputes how many answers exist per word length**; each
  found-words lane shows `found / total`.
- The seed word is **never shown**.

### Seed selection

- Candidates are dictionary words of 8–10 letters.
- The seed is chosen **deterministically from the date**, so every player gets
  the same game on the same day, and the game can be regenerated from the date.
- Recently used seeds are avoided so games do not repeat for a long time.
- Additional tuning (e.g. requiring enough vowels, or an interesting letter set)
  may be added later; it is not required by the rules.

## Playing a word

A word is **valid** if and only if all of the following hold:

1. It is **at least 4 letters** long.
2. Every letter it uses is in the **allowed letters** set (case-insensitive).
3. It appears in the **dictionary**.

Letters may repeat freely, so any word whose alphabet is a subset of the allowed
letters qualifies, regardless of how many times a letter appears.

Examples, with allowed letters `A I M N O T U`:

- `MOUNTAIN` — valid (it is the seed word).
- `AMOUNT` — valid.
- `MOUNT` — valid.
- `TINT` — valid: letters repeat, which is always allowed.
- `STONE` — invalid: `S` and `E` are not in the allowed set.
- `APPLE` — invalid: `P` and `L` are not allowed.

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
L = length of the seed word
```

This makes longer words worth **exponentially** more, and is calibrated so that
**the seed word scores exactly `2 × L`**:

```
points(L) = L + K^L = L + L = 2L
```

`K` is therefore **per-game** (it depends on the seed length). Points are
rounded to whole numbers.

### Worked examples

| Seed length `L` | `K` | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| 8  | 1.2968 | 7 | 9 | 10 | 12 | **16** | – | – |
| 9  | 1.2765 | 7 | 8 | 10 | 13 | 15 | **18** | – |
| 10 | 1.2589 | 7 | 8 | 10 | 12 | 14 | 17 | **20** |

(Bold = the seed word's score, `2L`.)

Notes:

- A word **longer** than the seed is possible (letters repeat), and scores more
  than `2L`. Nothing special happens except the star badge (below).
- The player's score for a game is the sum of the points of the words in their run.

## Badges

Badges are awarded per run and shown on the leaderboard. They signal achievement
without spoiling any words.

| Badge | Earned by |
|---|---|
| ☀ **Sun** | The run contains the **seed word**. |
| ⭐ **Star** | The run contains **one or more** non-seed words at least as long as the seed. |

Badges are computed by the server (it knows the seed). The client shows them on
found words and on leaderboard rows.

## Playing a game

- There is **one game per day**, fixed to **IST (UTC+5:30)** — a new game arrives at
  **00:00 IST** for everyone.
- **Today's game: one 3-minute timed attempt.** Press **Start** to begin (you can
  **pause** and resume). The score when the clock runs out is your **hare** score.
  The timer runs in your browser and is stored locally.
- **After the timer, keep playing.** Extra words don't change your hare score; they
  count toward your **tortoise** total instead.
- **Past games are untimed.** Revisit any past day and keep adding words for its
  tortoise total — no clock.
- **Your words auto-save** as you find them (signed-in players).
- **The only lock is peeking:** looking at another player's words permanently locks
  that game for you (see below).

## Leaderboards

- **Per-game board (Archive):** pick a date (from 2026-01-01 to today) and toggle
  **Hares** (timed scores) or **Tortoises** (totals). Shows that game's **top 10**,
  plus your own row if you're outside the top 10. Each row shows the player, the
  score, the ☀ badge, and a **peek** button.
- **All-time board (Leaderboard):** the same Hares/Tortoises toggle; ranks players by
  their total (or summed hare scores) and shows **games played** and **average per
  game**, sortable by each.
- **Opponents:** look up a player to see every daily score (hare and total).

## Peek mechanic (spoilers)

- A board row shows **only the player's points and badges** by default.
- **Peeking shows that player's words** — after a confirmation modal.
- Doing so **permanently locks that game for you**: you can no longer add words
  to it, now or on any future visit. The lock applies to the current day's game
  and to every past game alike.
- This means a player must choose: play blind and keep competing, or peek and
  forfeit that board. Badges are shown *without* expanding, so you can read the
  leaderboard for achievement signals without spoiling the words.

> **Testing note.** The lock is currently **disabled** (`REVEAL_LOCKS = false` in
> `src/server/config.ts`): peeking shows the words but records no lock. It will be
> enabled — starting from a fresh database — before the game goes public.

## Accounts

- An account (username + password) is required to **save your words** and appear
  on leaderboards; it is what makes your found words and locks persist.
- Browsing and playing are open to anonymous visitors, but nothing is recorded
  without signing in (anonymous progress is local to the tab and lost on reload).
- The peek lock is stored per account and per game.

## Rules summary

1. One game per day, from a hidden single seed word of 8–10 letters.
2. You get the distinct letters of the seed; reuse them freely.
3. A word scores if it is ≥ 4 letters, uses only allowed letters, and is in the
   dictionary.
4. `points(n) = round(n + K^n)`, `K = L^(1/L)`; the seed word scores `2L`.
5. Badges: ☀ the seed word, ⭐ a non-seed word ≥ the seed length.
6. Today: one 3-minute timed attempt (your **hare** score). After it — and on any
   past game — keep playing untimed for your **tortoise** total. A new game arrives
   at 00:00 IST, and your words auto-save.
7. Per-game and all-time boards, each with a **Hares / Tortoises** toggle.
8. Peeking at anyone's words locks that game for you permanently.

## Open questions

- Seed-selection tuning (vowel coverage, letter-set interest) — optional polish.
- Whether the all-time board should weight by number of games played.
- Scaling of the all-time board and the save write-rate as the player base grows
  (batch saves; materialize totals).
