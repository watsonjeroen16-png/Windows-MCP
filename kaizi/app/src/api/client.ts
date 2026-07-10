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
  phone: string;
  goals: GoalId[];
  identityWhy: string;
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
  smsPrefs: SmsPrefs;
}

export interface WelcomeSmsRequest {
  phone: string;
}

export interface ApiResult {
  ok: boolean;
  /** True when this result came from the offline mock, not the server. */
  offline: boolean;
}

export interface VerifyCheckResult extends ApiResult {
  /** ok=true and verified=false means the server rejected the code. */
  verified: boolean;
}

const BASE_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;
const MOCK_ACCEPTED_CODE = "000000";
const MOCK_LATENCY_MS = 450;

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

async function post<TBody extends object>(path: string, body: TBody): Promise<Response | null> {
  if (!BASE_URL) {
    warnOffline("EXPO_PUBLIC_API_URL is not set");
    return null;
  }
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok, offline: false };
}

/**
 * POST /api/verify/check — check the 6-digit code the user entered.
 * Server contract (kaizi/server/README.md): success is
 * `{"status":"approved","verified":true}`; a wrong code is
 * `400 {"error":"invalid_code"}` — a *handled* outcome, not a failure.
 */
export async function verifyCheck(request: VerifyCheckRequest): Promise<VerifyCheckResult> {
  const response = await post("/api/verify/check", request);
  if (response === null) {
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true, verified: request.code === MOCK_ACCEPTED_CODE };
  }
  try {
    const data = (await response.json()) as { verified?: boolean; error?: string };
    if (response.ok) return { ok: true, offline: false, verified: data.verified === true };
    if (response.status === 400 && data.error === "invalid_code") {
      return { ok: true, offline: false, verified: false };
    }
    return { ok: false, offline: false, verified: false };
  } catch {
    return { ok: false, offline: false, verified: false };
  }
}

/** POST /api/onboarding/profile — commit the completed onboarding profile. */
export async function submitProfile(request: OnboardingProfileRequest): Promise<ApiResult> {
  const response = await post("/api/onboarding/profile", request);
  if (response === null) {
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok, offline: false };
}

/**
 * POST /api/sms/welcome — enqueue the companion's first SMS.
 * A repeat call returns `409 already_welcomed` (kaizi/server/README.md);
 * that is benign here (e.g. handoff screen re-mounts), so treat it as ok.
 */
export async function sendWelcomeSms(request: WelcomeSmsRequest): Promise<ApiResult> {
  const response = await post("/api/sms/welcome", request);
  if (response === null) {
    await delay(MOCK_LATENCY_MS);
    return { ok: true, offline: true };
  }
  return { ok: response.ok || response.status === 409, offline: false };
}
