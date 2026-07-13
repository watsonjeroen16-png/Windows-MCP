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

  /** Drop phones with no hits inside the window — bounds memory growth (see L-3). */
  sweep(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [phone, hits] of this.hits) {
      const recent = hits.filter((t) => t > cutoff);
      if (recent.length === 0) this.hits.delete(phone);
      else this.hits.set(phone, recent);
    }
  }
}

/**
 * Aggregate circuit breaker for outbound SMS-triggering actions (Twilio
 * Verify sends, welcome sends). A per-IP/per-phone limiter alone doesn't cap
 * spend against a botnet of distinct phones/IPs (SMS-pumping / toll fraud,
 * see M-1 in docs/security-review.md); this trips independently of who's
 * asking once aggregate volume looks abnormal, so a spike gets stopped and
 * logged instead of silently draining the Twilio bill.
 */
export class GlobalSendCircuitBreaker {
  private hits: number[] = [];
  private tripped = false;

  constructor(
    private readonly max = 300,
    private readonly windowMs = 60 * 60 * 1000
  ) {}

  /** Returns true when the send is allowed; records the hit. */
  allow(now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    this.hits = this.hits.filter((t) => t > cutoff);
    if (this.hits.length >= this.max) {
      if (!this.tripped) {
        this.tripped = true;
        console.error(
          `[kaizi] GLOBAL SEND CIRCUIT BREAKER OPEN — ${this.hits.length} sends in the last ${Math.round(this.windowMs / 60_000)}min (limit ${this.max}). Refusing further sends until the window rolls over.`
        );
      }
      return false;
    }
    this.tripped = false;
    this.hits.push(now);
    return true;
  }

  get currentLoad(): number {
    return this.hits.length;
  }
}
