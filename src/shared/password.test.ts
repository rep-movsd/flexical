import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("accepts 6+ chars with a letter and a number", () => {
    expect(passwordProblem("abc123")).toBeNull();
    expect(passwordProblem("a1bcde")).toBeNull();
  });

  it("allows any symbols", () => {
    expect(passwordProblem("a1!@#$%^&*()_+-=")).toBeNull();
  });

  it("rejects too-short passwords", () => {
    expect(passwordProblem("a1bcd")).toMatch(/at least 6/);
  });

  it("requires a letter", () => {
    expect(passwordProblem("123456")).toMatch(/letter/);
  });

  it("requires a number", () => {
    expect(passwordProblem("abcdef")).toMatch(/number/);
  });
});
