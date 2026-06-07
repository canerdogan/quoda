import type { Bindings } from "../../types";
import {
  createMagicLink,
  getMagicLink,
  consumeMagicLink,
  getUserByEmail,
  createUser,
} from "../../db/queries";
import { sendMagicLink } from "./email";

const TOKEN_BYTES = 32;
const TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Hex-encode bytes. */
function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest of a string (Web Crypto only). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

/**
 * Issue a single-use magic link: generate a random token, store only its
 * SHA-256 hash with a 15-minute expiry, build the verify URL, and send it.
 */
export async function issueMagicLink(
  env: Bindings,
  email: string,
): Promise<{ token: string; url: string }> {
  const raw = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(raw);
  const token = toHex(raw);
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + TTL_MS;

  await createMagicLink(env.DB, { tokenHash, email, expiresAt });

  const url = `${env.APP_URL}/auth/verify?token=${token}`;
  await sendMagicLink(env, email, url);

  return { token, url };
}

/**
 * Verify a magic-link token: hash it, find an unexpired + unconsumed row,
 * mark it consumed, upsert the user by email, and return the user id. Returns
 * null for unknown, expired, or already-consumed tokens.
 */
export async function verifyMagicLink(
  env: Bindings,
  token: string,
): Promise<{ userId: string } | null> {
  const tokenHash = await sha256Hex(token);
  const link = await getMagicLink(env.DB, tokenHash);
  if (!link) return null;

  const now = Date.now();
  if (link.expires_at <= now) return null;

  // Atomically claim the token. The conditional UPDATE is the single source of
  // truth for single-use: if it didn't flip the row (already consumed, or a
  // concurrent verify won the race), reject. This closes the TOCTOU window.
  const claimed = await consumeMagicLink(env.DB, tokenHash, now);
  if (!claimed) return null;

  // Upsert user by email.
  let user = await getUserByEmail(env.DB, link.email);
  if (!user) {
    user = await createUser(env.DB, link.email);
  }

  return { userId: user.id };
}
