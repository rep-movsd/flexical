// Shared password policy, used by the server (authoritative) and the client
// (instant feedback). Rules: at least 6 characters, must contain a letter and a
// number, and any symbol is allowed.

export const MIN_PASSWORD_LENGTH = 6;
/** Guard against absurd input; not a real security limit. */
export const MAX_PASSWORD_LENGTH = 200;

/** Returns a human-readable problem, or null if the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
}
