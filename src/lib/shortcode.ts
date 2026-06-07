const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random base62 short code using a cryptographically secure RNG.
 * Rejection sampling keeps the distribution uniform (256 % 62 !== 0).
 */
export function genShortCode(len = 7): string {
  const out: string[] = [];
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length; // 248
  while (out.length < len) {
    const buf = new Uint8Array(len - out.length);
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= max) continue; // reject to avoid modulo bias
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === len) break;
    }
  }
  return out.join("");
}

/**
 * Generate a short code guaranteed not to collide with an existing
 * qr_codes.short_code. Retries with fresh codes on collision.
 */
export async function ensureUniqueShortCode(
  db: D1Database,
  len = 7,
): Promise<string> {
  // Bounded attempts to avoid an infinite loop if the space is exhausted.
  const maxAttempts = 1000;
  for (let i = 0; i < maxAttempts; i++) {
    const code = genShortCode(len);
    const existing = await db
      .prepare("SELECT 1 FROM qr_codes WHERE short_code = ? LIMIT 1")
      .bind(code)
      .first<{ 1: number }>();
    if (!existing) return code;
  }
  throw new Error("ensureUniqueShortCode: exhausted attempts finding a free code");
}
