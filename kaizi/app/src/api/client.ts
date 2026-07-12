/**
 * Kaizi onboarding API client.
 *
 * Base URL comes from EXPO_PUBLIC_API_URL (see .env.example). When the base
 * URL is missing or any request fails at the network layer, the client falls
 * back to a built-in offline mock so the entire onboarding flow remains
 * usable end-to-end: mock verification accepts the code 000000; all other
 * endpoints resolve success. The fallback is surfaced only as a console
 * warning — never as user-facing UI.
 */
import type { CompanionId, EnvironmentId, GoalId, PersonalityId } from "../data/ids";
import type { SmsPrefs } from "../state/OnboardingContext";

export interface VerifyStartRequest {
  phone: string; // E.164
}

export interface VerifyCheckRequest {
  phone: string;
  code: string; // 6 digits
}

export interface OnboardingProfileRequest {
  goals: GoalId[];
  identityWhy: string;
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
  smsPrefs: SmsPrefs;
}

export interface ApiResult {
  ok: boolean;
  /** True when this result came from the offline mock, not the server. */
  offline: boolean;
}

export interface VerifyCheckResult extends ApiResult {
  /** ok=true and verified=false means the server rejected the code. */
  verified: boolean;
  /**
   * Bearer session token bound to the verified phone (server:
   * kaizi/server/README.md). Present only when verified=true and offline is
   * false. Required as `Authorization: Bearer <token>` on submitProfile and
   * sendWelcomeSms — the server derives identity from this token, not from
   * any phone field in those requests.
   */
  token: string | null;
}

const BASE_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;
const MOCK_ACCEPTED_CODE = "000000";
const MOCK_LATENCY_MS = 450;
/** Stand-in token for the offline mock path — never sent to any server. */
const MOCK_OFFLINE_TOKEN = "offline-mock-token";

/**
 * True only inside a compiled release/production Metro bundle, where
 * `__DEV__` is injected as the literal `false`. Any environment where the
 * global isn't defined at all (a plain Node test run under vitest) or is
 * `true` (an Expo dev/simulator build) is treated as non-release, so
 * behavior there is unchanged — this only tightens behavior in real release
 * builds. See docs/security-review.md L-5 (offline mock fabricates
 * verification success) and L-6 (plain-HTTP base URL): a release build no
 * longer silently completes onboarding into a void when the server is
 * unreachable or misconfigured with a non-https URL — it surfaces a real
 * failure instead of a fabricated success.
 */
const isReleaseBuild = typeof __DEV__ !== "undefined" && __DEV__ === false;

/** Release builds must talk to an https origin — sending phone numbers and identity answers in the clear is never acceptable outside localhost dev. */
function isSafeBaseUrl(url: string): boolean {
  return !isReleaseBuild || url.startsWith("https://");
}

let warnedOffline = false;

function warnOffline(reason: string): void {
  if (!warnedOffline) {
    warnedOffline = true;
    console.warn(`[kaizi] offline mode: ${reason} — using built-in mock API`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function post<TBody extends object>(
  path: string,
  body: TBody,
  token?: string | null
): Promise<Response | null> {
  if (!BASE_URL) {
    warnOffline("EXPO_PUBLIC_API_URL is not set");
    return null;
  }
  if (!isSafeBaseUrl(BASE_URL)) {
    // Release build pointed at a non-https origin: refuse rather than send
    // phone numbers / identity answers in the clear (L-6). Falls through to
    // the same `null`-response path as an unreachable server; the caller
    // decides (via isReleaseBuild) whether that means "offline mock" or "a
    // real failure" — see each exported function below.
    warnOffline(`${BASE_URL} is not https`);
    return null;
  }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    warnOffline(`request to ${path} failed (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
}

/** POST /api/verify/start — ask the backend to text a verification code. */
export async function verifyStart(request: VerifyStartRequest): Promise<ApiResult> {
  const response = await post("/api/verify/start", request);
  if (response === null) {
    if (isReleaseBuild) {
      // L-5: a release build never fabricates success — surface the real
      // failure instead of pretending a verification code was sent.
      return { ok: false, offline: false };
    }
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok, offline: false };
}

/**
 * POST /api/verify/check — check the 6-digit code the user entered.
 * Server contract (kaizi/server/README.md): success is
 * `{"status":"approved","verified":true,"token":"...","expiresAt":"..."}`;
 * a wrong code is `400 {"error":"invalid_code"}` — a *handled* outcome, not
 * a failure. The returned `token` must be passed to submitProfile and
 * sendWelcomeSms — the server no longer accepts a bare phone number for
 * those two endpoints (see docs/security-review.md H-2).
 */
export async function verifyCheck(request: VerifyCheckRequest): Promise<VerifyCheckResult> {
  const response = await post("/api/verify/check", request);
  if (response === null) {
    if (isReleaseBuild) {
      // L-5: no magic code path in a shipped build.
      return { ok: false, offline: false, verified: false, token: null };
    }
    await delay(MOCK_LATENCY_MS);
    const verified = request.code === MOCK_ACCEPTED_CODE;
    return { ok: true, offline: true, verified, token: verified ? MOCK_OFFLINE_TOKEN : null };
  }
  try {
    const data = (await response.json()) as { verified?: boolean; error?: string; token?: string };
    if (response.ok) {
      return {
        ok: true,
        offline: false,
        verified: data.verified === true,
        token: data.verified === true && typeof data.token === "string" ? data.token : null,
      };
    }
    if (response.status === 400 && data.error === "invalid_code") {
      return { ok: true, offline: false, verified: false, token: null };
    }
    return { ok: false, offline: false, verified: false, token: null };
  } catch {
    return { ok: false, offline: false, verified: false, token: null };
  }
}

/**
 * POST /api/onboarding/profile — commit the completed onboarding profile.
 * `token` is the session token from a successful verifyCheck; sent as
 * `Authorization: Bearer <token>` (H-2). The server derives the phone from
 * it, so no phone is sent in the body.
 */
export async function submitProfile(
  request: OnboardingProfileRequest,
  token: string
): Promise<ApiResult> {
  const response = await post("/api/onboarding/profile", request, token);
  if (response === null) {
    if (isReleaseBuild) {
      return { ok: false, offline: false };
    }
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok, offline: false };
}

/**
 * POST /api/sms/welcome — enqueue the companion's first SMS. `token` is the
 * session token from verifyCheck, sent as `Authorization: Bearer <token>`
 * (H-2). A repeat call returns `409 already_welcomed`
 * (kaizi/server/README.md); that is benign here (e.g. handoff screen
 * re-mounts), so treat it as ok.
 */
export async function sendWelcomeSms(token: string): Promise<ApiResult> {
  const response = await post("/api/sms/welcome", {}, token);
  if (response === null) {
    if (isReleaseBuild) {
      return { ok: false, offline: false };
    }
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok || response.status === 409, offline: false };
}
