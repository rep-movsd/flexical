// Password hashing using the WebCrypto API available in Workers. We never store
// the plaintext password, only a random salt and a PBKDF2-SHA256 derived hash.

/** Iteration count. Bump over time; it is stored per-user so old hashes still verify. */
const ITERATIONS = 100_000;
/** Derived key length in bytes. */
const KEY_BYTES = 32;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export interface StoredPassword {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<StoredPassword> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
}

/** Constant-time comparison so verification time does not leak the hash. */
export async function verifyPassword(
  password: string,
  stored: StoredPassword,
): Promise<boolean> {
  const candidate = await derive(password, fromBase64(stored.salt), stored.iterations);
  const expected = fromBase64(stored.hash);
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate[i] ^ expected[i];
  return diff === 0;
}
