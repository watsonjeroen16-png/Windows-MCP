# Kaizi App — Onboarding

Expo (React Native + TypeScript) client for the Kaizi onboarding flow. This
build is **onboarding only**: seven screens (plus the verification-code and
handoff sub-screens inside step 7). The handoff confirmation screen is
terminal — the relationship continues over SMS, and the app rests there.

## Run

Requires Node 20+ (Expo SDK 57 / React Native 0.86).

```bash
cd kaizi/app
npm install
cp .env.example .env      # optional — leave EXPO_PUBLIC_API_URL unset for offline mode
npm start                 # Expo dev server; press i / a, or scan with Expo Go
```

Other scripts:

| Script | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` / `npm run web` | Start targeting a platform |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the Kaizi server (`http://localhost:4000` in dev). When unset or unreachable, **in dev/simulator builds** the app runs against a **built-in mock**: verification accepts code `000000`, all other endpoints resolve success. The fallback surfaces only as a console warning. |

**Release builds never fall back to the mock.** `src/api/client.ts` checks
the Metro-injected `__DEV__` global; in a compiled release bundle (`__DEV__
=== false`), an unreachable server or a non-`https` `EXPO_PUBLIC_API_URL`
returns a real `{ok: false}` instead of a fabricated success, and a plain-HTTP
base URL is refused before any request is sent (see
`docs/security-review.md` L-5/L-6). Dev, simulator, and test-suite behavior
is unaffected — the gate only activates in an actual release bundle.

The server contract (payloads, enums, error shapes) is documented in
`kaizi/server/README.md`. Enum ids (`wolf_pup`, `tough_love`,
`japanese_garden`, ...) are shared verbatim between `src/data/ids.ts` and the
backend — no mapping layer.

## Project structure

```
App.tsx                     # root: fonts, provider, background, step switcher
src/
  api/client.ts             # 4 endpoints + offline mock fallback
  data/                     # canonical ids + companion/personality/environment
  state/OnboardingContext.tsx  # context + reducer = the navigation state machine
  screens/                  # Welcome, Goals, Identity, Companion, Personality,
                            # Environment, SmsSetup, VerifyCode, Handoff
  ui/                       # design system
    tokens.ts               # 1:1 transcription of docs/design/tokens.md
    motion.tsx              # animation vocabulary (loops, xp-pop, slide, shake)
    ...components           # GlassCard, Chip, GoldButton, ProgressDots,
                            # PhoneInput, CodeInput, Toggle, ZenBackground,
                            # CompanionAvatar, EnvironmentTile, PersonalityCard, ...
```

### Why no router

The flow is 7 strictly linear screens ending on a terminal screen. Navigation
is a state-driven step switcher: `OnboardingContext` holds `step` (1-7),
`smsStage` (`phone | verify | handoff`), and the slide direction; Continue and
Back are reducer actions. expo-router would add deep links and URL state that
nothing here uses. The rationale is also documented in `App.tsx` and
`src/state/OnboardingContext.tsx`.

### Design system pointers

- **Source of truth**: `kaizi/docs/design/tokens.md` (transcribed to
  `src/ui/tokens.ts` — exact rgba values, type scale, radii, spacing,
  animation vocabulary) and `kaizi/docs/design/onboarding-spec.md`
  (screen-by-screen layout, copy, states).
- **Serif = meaning, sans = structure.** Companion speech is always quoted
  serif italic cream (`CompanionVoice`).
- **Quiet motion.** Ambient loops are slow, small-amplitude, ease-in-out
  (`src/ui/motion.tsx`); they freeze at midpoint under OS Reduce Motion while
  user-triggered transitions stay on.
- Fonts load via `@expo-google-fonts/cormorant-garamond` + `.../inter`;
  families are referenced only through `tokens.font`, so swapping is one line.

## Known deviations / follow-ups

- **Persistence**: onboarding state is in-memory; "resume at last incomplete
  step after kill" needs AsyncStorage (not in the approved dependency list).
  The reducer state is already serializable.
- **Phone validation** uses the shared E.164 regex (`^\+[1-9]\d{6,14}$`) plus
  a curated country list instead of libphonenumber; formatting-as-you-type is
  a light grouping, not per-country national formats.
- **Tertiary avatar twitches** (ear flick every 6s, occasional blink) are
  omitted; every species has the whole-figure idle-sway plus its primary
  secondary loop (tail wag, wing flex, mane sway, hair sway, breathing).
