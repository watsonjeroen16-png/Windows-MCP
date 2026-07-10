import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

/** Per-IP limiter for /api/verify/* — Twilio Verify costs money per attempt. */
export function createVerifyIpRateLimit(options: RateLimitOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? 60_000,
    limit: options.max ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });
}

/**
 * Per-phone guard, applied inside verify handlers (an attacker rotating IPs
 * must not be able to hammer a single phone number). In-memory sliding window;
 * one instance per app.
 */
export class PhoneRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max = 5,
    private readonly windowMs = 60_000
  ) {}

  /** Returns true when the request is allowed; records the hit. */
  allow(phone: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(phone) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.hits.set(phone, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(phone, recent);
    return true;
  }
}
