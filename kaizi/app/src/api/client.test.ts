import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// BASE_URL is read from process.env.EXPO_PUBLIC_API_URL at module load time,
// so the "online" tests reset modules and re-import after stubbing the env
// var — the "offline" tests rely on it being unset in this test environment
// (never configured in vitest.config.ts / CI env).

describe("api/client — offline mock (EXPO_PUBLIC_API_URL unset)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("verifyCheck accepts 000000 and issues a mock token; anything else is unverified with no token", async () => {
    const { verifyCheck } = await import("./client");
    const good = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(good.ok).toBe(true);
    expect(good.offline).toBe(true);
    expect(good.verified).toBe(true);
    expect(typeof good.token).toBe("string");
    expect(good.token).not.toBeNull();

    const bad = await verifyCheck({ phone: "+15551234567", code: "111111" });
    expect(bad.verified).toBe(false);
    expect(bad.token).toBeNull();
  });

  it("submitProfile and sendWelcomeSms resolve ok in offline mode regardless of token content", async () => {
    const { submitProfile, sendWelcomeSms } = await import("./client");
    const profile = await submitProfile(
      {
        goals: ["fitness"],
        identityWhy: "Because I want this for real.",
        companion: "fox",
        personality: "coach",
        environment: "japanese_garden",
        smsPrefs: { morning: true, evening: true },
      },
      "any-token-offline-mode-ignores-it"
    );
    expect(profile.ok).toBe(true);
    expect(profile.offline).toBe(true);

    const welcome = await sendWelcomeSms("any-token-offline-mode-ignores-it");
    expect(welcome.ok).toBe(true);
    expect(welcome.offline).toBe(true);
  });
});

describe("api/client — online (mocked fetch)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://test-server.invalid");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("verifyCheck surfaces the server-issued token on success", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "approved", verified: true, token: "real-token-xyz" }), {
        status: 200,
      })
    ) as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(result.ok).toBe(true);
    expect(result.offline).toBe(false);
    expect(result.verified).toBe(true);
    expect(result.token).toBe("real-token-xyz");
  });

  it("verifyCheck treats a wrong code (400 invalid_code) as a handled non-failure with no token", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_code" }), { status: 400 })
    ) as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "999999" });
    expect(result.ok).toBe(true); // handled outcome, not a network failure
    expect(result.verified).toBe(false);
    expect(result.token).toBeNull();
  });

  it("submitProfile sends the token as an Authorization bearer header and no phone in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, created: true }), { status: 201 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { submitProfile } = await import("./client");
    await submitProfile(
      {
        goals: ["fitness"],
        identityWhy: "Because I want this for real.",
        companion: "fox",
        personality: "coach",
        environment: "japanese_garden",
        smsPrefs: { morning: true, evening: true },
      },
      "session-token-123"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://test-server.invalid/api/onboarding/profile");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer session-token-123");
    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody.phone).toBeUndefined();
    expect(sentBody.goals).toEqual(["fitness"]);
  });

  it("sendWelcomeSms treats 409 already_welcomed as ok (benign repeat)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "already_welcomed" }), { status: 409 })) as unknown as typeof fetch;

    const { sendWelcomeSms } = await import("./client");
    const result = await sendWelcomeSms("session-token-123");
    expect(result.ok).toBe(true);
    expect(result.offline).toBe(false);
  });

  it("falls back to the offline mock when fetch throws (network down)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(result.offline).toBe(true);
    expect(result.verified).toBe(true);
  });
});

// __DEV__ is a Metro-injected global, undefined in this plain-Node vitest
// environment (see vitest.config.ts). These tests simulate a compiled
// release build by stubbing it to the literal `false` Metro would inject —
// see docs/security-review.md L-5 (offline mock fabricates verification
// success) and L-6 (plain-HTTP base URL).
describe("api/client — release build (__DEV__ === false)", () => {
  const originalFetch = global.fetch;

  function setDev(value: boolean | undefined): void {
    (globalThis as unknown as { __DEV__?: boolean }).__DEV__ = value;
  }

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    setDev(undefined);
  });

  it("never fabricates success when the server is unreachable — surfaces a real failure instead", async () => {
    vi.resetModules();
    setDev(false);
    // EXPO_PUBLIC_API_URL left unset — same "server unreachable" trigger as
    // the offline-mock tests above, but this time in a release build.
    const { verifyStart, verifyCheck, submitProfile, sendWelcomeSms } = await import("./client");

    const start = await verifyStart({ phone: "+15551234567" });
    expect(start.ok).toBe(false);
    expect(start.offline).toBe(false);

    const check = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(check.ok).toBe(false);
    expect(check.offline).toBe(false);
    expect(check.verified).toBe(false);
    expect(check.token).toBeNull();

    const profile = await submitProfile(
      {
        goals: ["fitness"],
        identityWhy: "Because I want this for real.",
        companion: "fox",
        personality: "coach",
        environment: "japanese_garden",
        smsPrefs: { morning: true, evening: true },
      },
      "any-token"
    );
    expect(profile.ok).toBe(false);
    expect(profile.offline).toBe(false);

    const welcome = await sendWelcomeSms("any-token");
    expect(welcome.ok).toBe(false);
    expect(welcome.offline).toBe(false);
  });

  it("never fabricates success when fetch throws (network down)", async () => {
    vi.resetModules();
    setDev(false);
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.kaizi.example");
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(result.ok).toBe(false);
    expect(result.offline).toBe(false);
    expect(result.verified).toBe(false);
  });

  it("rejects a non-https base URL without ever calling fetch (L-6)", async () => {
    vi.resetModules();
    setDev(false);
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://api.kaizi.example");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a real https server response still works normally in a release build", async () => {
    vi.resetModules();
    setDev(false);
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.kaizi.example");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "approved", verified: true, token: "real-token" }), {
        status: 200,
      })
    ) as unknown as typeof fetch;

    const { verifyCheck } = await import("./client");
    const result = await verifyCheck({ phone: "+15551234567", code: "000000" });
    expect(result.ok).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.token).toBe("real-token");
  });
});
