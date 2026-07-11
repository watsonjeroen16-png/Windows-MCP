/**
 * Short-lived, HMAC-signed session tokens issued on successful phone
 * verification (POST /api/verify/check) and required as a bearer credential
 * on the two endpoints that write/read a user's onboarding data
 * (/api/onboarding/profile, /api/sms/welcome).
 *
 * Stateless by design (no session table): the token embeds the verified
 * phone and an expiry, signed with a server secret. Anyone possessing a
 * valid token has proven they completed verification for that phone within
 * the token's lifetime — the routes derive the phone from the token instead
 * of trusting a bare phone number in the request body (closes H-2 in
 * docs/security-review.md).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionTokenService {
  /** Issue a token bound to `phone`, valid for the configured TTL. */
  issue(phone: string): { token: string; expiresAt: string };
  /** Verify a token; returns the bound phone if valid and unexpired, else null. */
  verify(token: string): string | null;
}

export const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface TokenPayload {
  phone: string;
  exp: number; // epoch ms
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function sign(secret: string, payload: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

/** Constant-time signature comparison (avoids timing side channels). */
function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createSessionTokenService(
  secret: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS
): SessionTokenService {
  if (!secret) {
    throw new Error("createSessionTokenService requires a non-empty secret");
  }

  return {
    issue(phone: string) {
      const exp = Date.now() + ttlMs;
      const payload: TokenPayload = { phone, exp };
      const payloadEncoded = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
      const signature = sign(secret, payloadEncoded);
      return { token: `${payloadEncoded}.${signature}`, expiresAt: new Date(exp).toISOString() };
    },

    verify(token: string): string | null {
      if (typeof token !== "string" || token.length === 0) return null;
      const dot = token.lastIndexOf(".");
      if (dot <= 0) return null;
      const payloadEncoded = token.slice(0, dot);
      const signature = token.slice(dot + 1);

      const expectedSignature = sign(secret, payloadEncoded);
      if (!signaturesMatch(signature, expectedSignature)) return null;

      let payload: TokenPayload;
      try {
        payload = JSON.parse(base64urlDecode(payloadEncoded).toString("utf8")) as TokenPayload;
      } catch {
        return null;
      }
      if (typeof payload.phone !== "string" || typeof payload.exp !== "number") return null;
      if (Date.now() > payload.exp) return null;

      return payload.phone;
    },
  };
}
