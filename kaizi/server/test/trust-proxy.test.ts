/**
 * Regression test for docs/security-review.md L-2: express-rate-limit and
 * PhoneRateLimiter key on `req.ip`, which falls back to the raw socket
 * address (the reverse proxy's IP on Railway/any PaaS behind a single-hop
 * LB) unless Express is told to trust exactly one proxy hop in production.
 * Without this, per-IP verify rate limiting silently degrades to one shared
 * global bucket for every user behind the same proxy.
 */
import { afterEach, describe, expect, it } from "vitest";

import { makeTestApp } from "./helpers/make-app.js";

describe("trust proxy setting", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("trusts exactly 1 proxy hop when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    const { app } = makeTestApp();
    expect(app.get("trust proxy")).toBe(1);
  });

  it("does not trust any proxy hop outside production (dev/test default)", () => {
    process.env.NODE_ENV = "test";
    const { app } = makeTestApp();
    expect(app.get("trust proxy")).toBeFalsy();
  });
});
