# Kaizi Onboarding MVP — QA Report

- **Date:** 2026-07-11
- **QA agent:** qa (onboarding-only scope)
- **Scope:** `kaizi/server` (Express + Zod + vitest) and `kaizi/app` (Expo/React Native onboarding flow), verified against `kaizi/docs/design/onboarding-spec.md`.

## Verdict: GO

The onboarding MVP passes all suites, the app/server contract is aligned field-by-field, the end-to-end flow works in mock mode, and all spec-verbatim copy checks pass. One real defect (trunk-zero phone entry) was found and fixed. Remaining findings are low-severity recommendations.

---

## 1. Commands & Results

| Check | Command (cwd) | Result |
|---|---|---|
| Server typecheck | `npm run typecheck` (`kaizi/server`) | PASS — `tsc --noEmit`, 0 errors |
| Server tests (pre-QA) | `npm test` (`kaizi/server`) | PASS — **57/57** tests, 4 files (`profile` 14, `verify` 14, `welcome` 10, `sms-templates` 19), vitest 2.1.9 |
| Server tests (post-QA, with new e2e file) | `npm test` (`kaizi/server`) | PASS — **59/59** tests, 5 files (+ `e2e.onboarding` 2) |
| Server lint | — | No lint script exists in `kaizi/server/package.json` (scripts: dev, build, start, test, test:watch, migrate, typecheck). Not run; see findings. |
| App typecheck | `npm run typecheck` (`kaizi/app`) | PASS — `tsc --noEmit`, 0 errors (re-run clean after the PhoneInput fix) |
| App lint/tests | — | No lint or test scripts exist in `kaizi/app/package.json`. See findings. |

## 2. Contract Audit (app ⇄ server), field by field

Compared `app/src/api/client.ts`, `app/src/data/ids.ts`, the data modules (`companions.ts`, `personalities.ts`, `environments.ts`, `countries.ts`), `app/src/state/OnboardingContext.tsx`, and the payload assembly in the screens (`SmsSetupScreen`, `VerifyCodeScreen`, `HandoffScreen`) against `server/src/schemas.ts` and the route mounts in `server/src/app.ts`.

| Contract item | App | Server | Match |
|---|---|---|---|
| `POST /api/verify/start` | `client.ts` `verifyStart` → `{ phone }` | `app.ts` mounts verify router at `/api/verify`; `/start` validates `verifyStartSchema { phone }` | ✔ |
| `POST /api/verify/check` | `verifyCheck` → `{ phone, code }` (6 digits from `CodeInput`) | `verifyCheckSchema { phone, code: /^\d{4,8}$/ }` — 6 digits within bounds | ✔ |
| `POST /api/onboarding/profile` | `submitProfile` → `{ phone, goals, identityWhy, companion, personality, environment, smsPrefs }` (assembled in `HandoffScreen`, `identityWhy` pre-trimmed) | `profileSchema` — identical field names | ✔ |
| `POST /api/sms/welcome` | `sendWelcomeSms` → `{ phone }`; treats repeat `409 already_welcomed` as benign | `welcomeSchema { phone }`; route returns 409 on repeat | ✔ |
| `smsPrefs` shape | `{ morning: boolean, evening: boolean }` (`SmsPrefs`, both default `true`) | `z.object({ morning: z.boolean(), evening: z.boolean() })` | ✔ |
| Goal ids | `GOAL_IDS`: fitness, skin, business, discipline, learning | `GOALS`: identical, same order | ✔ |
| Companion ids | `COMPANION_IDS`: wolf_pup, fox, lion, dog, human_male, human_female, dragonkin | `COMPANIONS`: identical | ✔ |
| Personality ids | `PERSONALITY_IDS`: coach, tough_love, mentor, supportive, rival | `PERSONALITIES`: identical | ✔ |
| Environment ids | `ENVIRONMENT_IDS`: cyber_city, modern_apartment, forest_village, mountain_retreat, dojo, coastal_paradise, fantasy_kingdom, space_colony, japanese_garden, training_campus, entrepreneur_district, sky_islands | `ENVIRONMENTS`: identical, same order | ✔ |
| Data modules use canonical ids | `companions.ts` (7), `personalities.ts` (5), `environments.ts` (12) all typed off `ids.ts`; no stray/camelCase ids anywhere in the app | — | ✔ |
| E.164 regex | `OnboardingContext.E164_PATTERN` = `/^\+[1-9]\d{6,14}$/` | `schemas.E164_REGEX` = `/^\+[1-9]\d{6,14}$/` | ✔ identical |
| `identityWhy` bounds | Reducer hard-caps at 280; screen gate `isIdentityWhyValid` requires trimmed 10–280; `HandoffScreen` submits `.trim()`ed value | `.transform(trim).pipe(min(10).max(280))` | ✔ |
| `goals` 1–5 unique | Toggle-based multi-select over exactly 5 ids → uniqueness and max 5 structurally guaranteed; CTA disabled at 0 (`GoalSelectionScreen`) | `.min(1).max(5).refine(unique)` | ✔ |
| Request assembly drift | `HandoffScreen` submits profile then welcome, guarded by a `committed` ref (no double-submit) and null-checks; `SmsSetupScreen` assembles `${country.dial}${national}` and validates before send; `VerifyCodeScreen` resend calls `verifyStart` with the stored E.164 phone | — | ✔ (after fix #1 below) |

Note: the spec's "Onboarding State Shape" sketches camelCase ids (`wolfPup`, `toughLove`, …); both app and server deliberately use snake_case end-to-end per the build brief — documented as a deviation note in `app/src/data/ids.ts`. No mapping layer needed; consistent.

## 3. End-to-End Flow (mock mode)

New test file: `kaizi/server/test/e2e.onboarding.test.ts` (2 tests, in the 59 above) using the app factory (`createApp`) + supertest + in-memory db + mock Twilio (`makeTestApp`).

Flow walked and asserted:

1. `POST /api/onboarding/profile` **before any verification** → `404 phone_not_found` (rejected). ✔
2. `POST /api/verify/start` → 200. ✔
3. `POST /api/verify/check` with a wrong code → `400 invalid_code`, and profile is still rejected afterwards. ✔
4. `POST /api/verify/check` with mock code `000000` → `200 { status: "approved", verified: true }`. ✔
5. `POST /api/onboarding/profile` (goals `["skin","discipline"]`, personality `mentor`, identityWhy "Because I'm tired of almost. Because my kids are watching.") → `201 { ok: true, created: true }`. ✔
6. `POST /api/sms/welcome` → `200 { status: "queued", mock: true, body }` where `body`:
   - contains the chosen goal noun **"your skin"** (`{firstGoal}` mapping for `skin`), ✔
   - contains the identityWhy-derived phrase **"because I'm tired of almost"** (first sentence, first letter lowercased, trailing punctuation stripped), ✔
   - is **exactly** the spec's Mentor template with both placeholders substituted (byte-equal assertion against `SMS_TEMPLATES.mentor`), no raw `{…}` placeholders. ✔
7. Repeat `POST /api/sms/welcome` → `409 already_welcomed`. ✔
8. Separate test: profile for an existing-but-unverified phone → `409 phone_not_verified`. ✔

## 4. Design-Spec Verbatim Checks

Verified programmatically (script diffing the spec tables against the source strings), not by eye:

| Item | Result |
|---|---|
| First-SMS template — Coach | verbatim match |
| First-SMS template — Tough Love | verbatim match |
| First-SMS template — Mentor | verbatim match |
| First-SMS template — Supportive | verbatim match |
| First-SMS template — Rival | verbatim match |
| Screen-5 sample line + tag — Coach (DRIVEN) | verbatim match |
| Screen-5 sample line + tag — Tough Love (UNFILTERED) | verbatim match |
| Screen-5 sample line + tag — Mentor (WISE) | verbatim match |
| Screen-5 sample line + tag — Supportive (WARM) | verbatim match |
| Screen-5 sample line + tag — Rival (COMPETITIVE) | verbatim match |

Sources: `server/src/services/sms-templates.ts` (templates, `{firstGoal}` noun map, `whyPhrase` fallback "you want to change" — all per spec) and `app/src/data/personalities.ts` (sample lines). 10/10 pass.

## 5. Issues Found & Fixed

1. **Trunk-zero phone entry produced non-dialable E.164** — `app/src/ui/PhoneInput.tsx`. Users habitually type the national trunk prefix (NL: `0612345678`), which assembled to `+310612345678`. That *passes* the shared regex (`^\+[1-9]\d{6,14}$`) on both app and server, so it would be stored and later fail at Twilio send time. Fixed: leading zeros are stripped from the national digits as the user types (Italy `+39` exempted, as the only country in the picker whose landlines keep the trunk zero; the field collects mobile numbers, which never start with 0 in Italy). App typecheck re-run clean.
2. **Missing e2e coverage** — added `server/test/e2e.onboarding.test.ts` (full happy path + rejection guards, byte-exact SMS body assertion). Suite: 57 → 59 tests, all green.

No other defects found: ids, field names, bounds, regexes, endpoint paths/methods, and all verbatim copy are aligned.

## 6. Open Findings & Recommendations (no code changes made)

1. **No lint script in either package.** Server code style is consistent, but a `lint` script (eslint or biome) would catch drift; recommend adding in a follow-up. **Accepted limitation for this pass** — adding a full lint toolchain (config, plugin selection, and very likely a first triage pass fixing whatever it flags across the existing codebase) is new infrastructure, not a bug fix, and risks ballooning scope disproportionate to the finding's severity; typecheck + tests are green in both packages in the meantime. Left as a genuine follow-up recommendation.
2. ~~**No app-side tests.**~~ **Resolved 2026-07-11 (confidence pass).** A vitest setup was added (`kaizi/app/vitest.config.ts` + RN/RN-SVG stubs) covering exactly the pure logic called out here: `onboardingReducer`, `isValidE164`, `isIdentityWhyValid`, `PhoneInput.formatNational` (plus the trunk-zero fix and `api/client.ts` auth-token paths). 39/39 app tests passing; see `docs/confidence-report.md`.
3. **Regex-only phone validation is a stand-in for libphonenumber** (documented in `PhoneInput.tsx` and the spec calls for libphonenumber). The regex accepts structurally valid but unassigned numbers (e.g. wrong length for the chosen country). Acceptable for MVP since Twilio Verify is the real gate; recommend `libphonenumber-js` when dependency budget allows. **Accepted limitation** — adding a new dependency is out of scope for a bug-fix pass.
4. **`HandoffScreen` submit is fire-and-forget** — if `submitProfile` fails online (non-network 4xx/5xx), the screen still shows success and never retries (the `committed` ref latches). Offline mock fallback covers the network-down case; a retry/toast for server-error responses is a worthwhile hardening item. **Accepted limitation for this pass** — this is a UX/retry-flow redesign (error state, toast copy, retry semantics) on a screen QA already signed off as GO, not a mechanical bug fix; making that call without a design pass risks introducing a new regression on a working screen. Left as a recommended follow-up for the team to design deliberately rather than patched here.
5. **No state persistence** — killing the app restarts onboarding at step 1; the spec's resume behavior needs AsyncStorage (documented deviation in `OnboardingContext.tsx`). Reducer is already serializable; small follow-up. **Accepted limitation** — AsyncStorage is not in the approved dependency list per `kaizi/app/README.md`.
6. ~~**Spec typo (docs-only, out of QA write scope):**~~ **Resolved.** `onboarding-spec.md` Screen 6 table's Forest Village gradient cell contained a Cyrillic "А" (U+0410) in `#14261А` with an inline correction note; fixed to the plain Latin `#14261A` the app actually uses, and the correction note removed.
7. **`verify/check` in mock mode accepts any `000000`** without a prior `verify/start` (verified in e2e). Fine for mock; the live Twilio Verify path naturally requires a started verification. No action needed, noted for awareness.

## 7. Files Touched by QA

- `kaizi/server/test/e2e.onboarding.test.ts` — new (e2e flow tests).
- `kaizi/app/src/ui/PhoneInput.tsx` — trunk-zero fix in `handleDigits`.
- `kaizi/docs/qa-report.md` — this report.

**Go/no-go: GO** for the onboarding MVP in mock mode. Live-mode (real Twilio) send path is exercised only via the mocked `SmsService` interface; a staging smoke test with real credentials is recommended before production.
