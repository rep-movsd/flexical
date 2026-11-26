import { describe, expect, it } from "vitest";
import { computeBadgeWords, computeBadges } from "./badges";
import { createDictionary } from "./dictionary";
import { allowedLetters, isBuildable, toLetterSet } from "./letters";
import { computeK, pointsForLength, scoreWords } from "./scoring";
import { pickSeeds, seedCandidates } from "./seeds";
import { progressAt, type GhostWord } from "./timeline";
import { classifyWords } from "./validation";

// Contracts for the game engine. These describe the rules in game.md and should
// stay green as the game evolves.

describe("allowedLetters", () => {
  it("returns the distinct letters of both seeds, sorted", () => {
    expect(allowedLetters("MOUNTAIN", "TRAINERS")).toEqual(
      "AEIMNORSTU".split(""),
    );
  });

  it("collapses duplicates", () => {
    expect(allowedLetters("AA", "A")).toEqual(["A"]);
  });
});

describe("isBuildable", () => {
  const set = toLetterSet(allowedLetters("MOUNTAIN", "TRAINERS"));

  it("accepts a word using only allowed letters", () => {
    expect(isBuildable("STONE", set)).toBe(true);
  });

  it("allows letters to repeat", () => {
    expect(isBuildable("TENET", set)).toBe(true);
  });

  it("rejects a word with a disallowed letter", () => {
    expect(isBuildable("APPLE", set)).toBe(false);
  });
});

describe("scoring", () => {
  it("scores the longest seed word exactly 2L", () => {
    for (const L of [8, 9, 10]) {
      const k = computeK(L);
      expect(pointsForLength(L, k)).toBe(2 * L);
    }
  });

  it("increases with word length", () => {
    const k = computeK(9);
    const values = [4, 5, 6, 7, 8, 9].map((n) => pointsForLength(n, k));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("scores nothing below the minimum length", () => {
    expect(pointsForLength(3, computeK(9))).toBe(0);
  });

  it("sums word scores", () => {
    const k = computeK(10);
    expect(scoreWords(["word", "words"], k)).toBe(
      pointsForLength(4, k) + pointsForLength(5, k),
    );
  });
});

describe("badges", () => {
  const seedA = "mountain";
  const seedB = "trainers";

  it("awards sun for seed A and moon for seed B", () => {
    expect(computeBadges([seedA, seedB], seedA, seedB)).toEqual({
      sun: true,
      moon: true,
      star: false,
    });
  });

  it("awards star for a non-seed word at least as long as the shorter seed", () => {
    expect(computeBadges(["strainer"], seedA, seedB).star).toBe(true);
  });

  it("does not award star for a short word", () => {
    expect(computeBadges(["stone"], seedA, seedB).star).toBe(false);
  });

  it("reports which words earned each badge", () => {
    expect(computeBadgeWords(["mandarin", "hardship"], "snappish", "mandarin")).toEqual({
      sun: null,
      moon: "mandarin",
      star: "hardship",
    });
  });
});

describe("classifyWords", () => {
  const dict = createDictionary(["stone", "tenet", "apple", "strainer"]);
  const allowed = toLetterSet(allowedLetters("MOUNTAIN", "TRAINERS"));
  const k = computeK(9);

  it("accepts valid words and rejects others with reasons", () => {
    const result = classifyWords(
      [
        { word: "stone" },
        { word: "STONE" },
        { word: "apple" },
        { word: "sea" },
        { word: "zzzz" },
      ],
      allowed,
      dict,
      k,
    );
    expect(result.accepted).toEqual(["stone"]);
    expect(result.rejected).toEqual([
      { word: "stone", reason: "duplicate" },
      { word: "apple", reason: "not_in_rack" },
      { word: "sea", reason: "too_short" },
      { word: "zzzz", reason: "not_in_rack" },
    ]);
    expect(result.score).toBe(pointsForLength(5, k));
  });

  it("reports unknown for a buildable non-word", () => {
    const result = classifyWords([{ word: "tennet" }], allowed, dict, k);
    expect(result.rejected).toEqual([{ word: "tennet", reason: "unknown" }]);
  });
});

describe("seeds", () => {
  const dict = createDictionary([
    "mountain",
    "trainers",
    "elephant",
    "computer",
    "saturday",
    "television",
  ]);

  it("picks two distinct candidates, deterministically", () => {
    const first = pickSeeds("2026-11-26", dict);
    const again = pickSeeds("2026-11-26", dict);
    expect(first[0]).not.toBe(first[1]);
    expect(again).toEqual(first);
  });

  it("respects the avoid set", () => {
    const [a, b] = pickSeeds("2026-11-26", dict);
    const avoid = new Set([`${[a, b].sort().join("|")}`]);
    const next = pickSeeds("2026-11-26", dict, avoid);
    expect([next[0], next[1]].sort().join("|")).not.toBe([a, b].sort().join("|"));
  });

  it("finds 8–10 letter candidates", () => {
    expect(seedCandidates(dict).every((w) => w.length >= 8 && w.length <= 10)).toBe(true);
  });
});

describe("ghost timeline", () => {
  const timeline: GhostWord[] = [
    { len: 4, points: 7, t: 1000 },
    { len: 5, points: 8, t: 3000 },
    { len: 8, points: 14, t: 5000 },
  ];

  it("accumulates as time passes", () => {
    expect(progressAt(timeline, 0)).toEqual({ score: 0, count: 0 });
    expect(progressAt(timeline, 1000)).toEqual({ score: 7, count: 1 });
    expect(progressAt(timeline, 4000)).toEqual({ score: 15, count: 2 });
    expect(progressAt(timeline, 9999)).toEqual({ score: 29, count: 3 });
  });
});
