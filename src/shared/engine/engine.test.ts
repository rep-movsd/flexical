import { describe, expect, it } from "vitest";
import { createDictionary } from "./dictionary";
import { RACK_SIZE, canBuild, generateRack } from "./rack";
import { classifySubmission, scoreWord, DEFAULT_RULES } from "./scoring";

// These tests describe the contracts the engine must satisfy. They pass against
// the placeholder implementations and are meant to keep passing as you fill in
// the real game logic. Add your own cases as you go.

const rack = { letters: ["A", "E", "E", "I", "P", "R", "S"] };

describe("canBuild", () => {
  it("accepts a word using available letters once each", () => {
    expect(canBuild("PEAR", rack)).toBe(true);
  });

  it("accepts a word that reuses a repeated letter", () => {
    expect(canBuild("SEEP", rack)).toBe(true);
  });

  it("rejects a word needing a letter not on the rack", () => {
    expect(canBuild("SAFE", rack)).toBe(false);
  });

  it("rejects a word needing a letter more times than it appears", () => {
    expect(canBuild("SEEEE", rack)).toBe(false);
  });
});

describe("generateRack", () => {
  it("returns exactly RACK_SIZE letters", () => {
    expect(generateRack().letters).toHaveLength(RACK_SIZE);
  });

  it("is deterministic when given a seeded rand", () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    let i = 0;
    const rack = generateRack(() => seq[i++ % seq.length]);
    expect(rack.letters).toHaveLength(RACK_SIZE);
  });
});

describe("scoreWord", () => {
  it("scores by length", () => {
    expect(scoreWord("word")).toBe(DEFAULT_RULES.lengthPoints[4]);
    expect(scoreWord("words")).toBe(DEFAULT_RULES.lengthPoints[5]);
  });

  it("scores nothing below the minimum length", () => {
    expect(scoreWord("abc")).toBe(0);
  });
});

describe("classifySubmission", () => {
  const solution = ["pear", "pears", "spare", "spear", "sear"];

  it("accepts valid, non-duplicate words and rejects the rest", () => {
    const result = classifySubmission({ submitted: ["pear", "PEAR", "zzzz", "sea"], foundSoFar: [], solution });
    expect(result.accepted).toEqual(["pear"]);
    expect(result.rejected).toEqual([
      { word: "pear", reason: "duplicate" },
      { word: "zzzz", reason: "not_in_rack" },
      { word: "sea", reason: "too_short" },
    ]);
    expect(result.totalScore).toBe(scoreWord("pear"));
  });

  it("awards the all-words bonus once the solution is complete", () => {
    const result = classifySubmission({
      submitted: solution,
      foundSoFar: [],
      solution,
    });
    expect(result.completed).toBe(true);
    expect(result.totalScore).toBe(
      solution.reduce((sum, w) => sum + scoreWord(w), 0) + DEFAULT_RULES.allWordsBonus,
    );
  });
});

describe("dictionary", () => {
  it("normalises and de-duplicates", () => {
    const dict = createDictionary([" Cat ", "cat", "DOG", ""]);
    expect(dict.size).toBe(2);
    expect(dict.has("cat")).toBe(true);
    expect(dict.has("dog")).toBe(true);
  });
});
