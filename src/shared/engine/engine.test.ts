import { describe, expect, it } from "vitest";
import { computeBadgeWords, computeBadges } from "./badges";
import { countAnswersByLength, totalAnswers } from "./answers";
import { createDictionary } from "./dictionary";
import { allowedLetters, isBuildable, toLetterSet } from "./letters";
import { computeK, pointsForLength, scoreWords } from "./scoring";
import { pickSeed, seedCandidates } from "./seeds";
import { classifyWords } from "./validation";

// Contracts for the game engine. These describe the rules in game.md and should
// stay green as the game evolves.

describe("allowedLetters", () => {
  it("returns the distinct letters of the seed, sorted", () => {
    expect(allowedLetters("MOUNTAIN")).toEqual("AIMNOTU".split(""));
  });

  it("collapses duplicates", () => {
    expect(allowedLetters("AA")).toEqual(["A"]);
  });
});

describe("isBuildable", () => {
  const set = toLetterSet("AEIMNORSTU".split(""));

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
  it("awards sun for the seed word", () => {
    expect(computeBadges(["mountain"], "mountain")).toEqual({ sun: true, star: false });
  });

  it("awards star for a non-seed word at least as long as the seed", () => {
    expect(computeBadges(["mountain", "strainer"], "mountain").star).toBe(true);
  });

  it("does not award star for a short word", () => {
    expect(computeBadges(["stone"], "mountain").star).toBe(false);
  });

  it("reports which words earned each badge", () => {
    expect(computeBadgeWords(["mandarin", "hardship"], "snappish")).toEqual({
      sun: null,
      star: "hardship",
    });
  });
});

describe("classifyWords", () => {
  const dict = createDictionary(["stone", "tenet", "apple", "strainer"]);
  const allowed = toLetterSet("AEIMNORSTU".split(""));
  const k = computeK(9);

  it("accepts valid words and rejects others with reasons", () => {
    const result = classifyWords(
      ["stone", "STONE", "apple", "sea", "zzzz"],
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
    const result = classifyWords(["tennet"], allowed, dict, k);
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

  it("picks a candidate, deterministically", () => {
    const seed = pickSeed("2026-11-26", dict);
    expect(seed).toBe(pickSeed("2026-11-26", dict));
    expect(seed.length).toBeGreaterThanOrEqual(8);
    expect(seed.length).toBeLessThanOrEqual(10);
  });

  it("respects the avoid set", () => {
    const seed = pickSeed("2026-11-26", dict);
    const next = pickSeed("2026-11-26", dict, new Set([seed]));
    expect(next).not.toBe(seed);
  });

  it("finds 8–10 letter candidates", () => {
    expect(seedCandidates(dict).every((w) => w.length >= 8 && w.length <= 10)).toBe(true);
  });
});

describe("answer counts", () => {
  const dict = createDictionary(["stone", "tenet", "strainer", "star", "apple", "cat"]);
  const allowed = toLetterSet("AEIMNORSTU".split(""));

  it("counts buildable words per length", () => {
    const counts = countAnswersByLength(allowed, dict, 4);
    expect(counts).toEqual([
      { length: 4, count: 1 }, // star
      { length: 5, count: 2 }, // stone, tenet
      { length: 8, count: 1 }, // strainer
    ]);
    expect(totalAnswers(counts)).toBe(4);
  });

  it("counts the seeded game's real answer set", () => {
    // ADHIMNPRS rack: verify the count matches a direct scan.
    const rack = toLetterSet("ADHIMNPRS");
    const words = ["mandarin", "hardship", "randomish", "brain", "zebra", "aim"];
    const counts = countAnswersByLength(rack, createDictionary(words), 4);
    const expected = words.filter(
      (w) => w.length >= 4 && [...w.toUpperCase()].every((c) => rack.has(c)),
    ).length;
    expect(totalAnswers(counts)).toBe(expected);
  });
});
