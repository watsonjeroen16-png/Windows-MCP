# Kaizi App

Expo (React Native + TypeScript) client for Kaizi. **Two phases, both built
(as of 2026-07-12):**

1. **Onboarding** — 8 linear screens (Welcome, Goals, Identity/"Why", a
   10-question personalization quiz, Companion, Personality, Environment, SMS
   setup — the verification-code and handoff sub-screens live inside the SMS
   step), ending on a handoff screen.
2. **Companion World** — the handoff screen is no longer terminal. It hands
   off into `KaiziApp.tsx`: a two-destination **World/You** structure
   (`kaizi/docs/design/app-restructure-v3.md`) — World is the app's only
   home (zone travel strip, companion, chat FAB, intentions pouch), You is a
   deliberate side trip (Progress/Companion/Settings tabs) reached via an
   avatar chip, no persistent tab bar. Chat, Intentions, and Reflection are
   contextual bottom sheets over the World, not separate screens.

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
App.tsx                     # root: fonts, provider, background, onboarding step
                            # switcher; hands off into KaiziApp.tsx on completion
src/
  api/client.ts             # onboarding + Companion World endpoints, offline mock fallback
  data/                     # canonical ids + companion/personality/environment + zones/quiz
  state/
    OnboardingContext.tsx    # context + reducer = the onboarding state machine
    WorldContext.tsx         # context + reducer = World/You nav + zone/weather/sheet state
  screens/                  # Welcome, GoalSelection, IdentityInput, Quiz,
                            # CompanionSelection, PersonalitySelection,
                            # EnvironmentSelection, SmsSetup, VerifyCode, Handoff
                            # (onboarding), then KaiziApp, WorldScreen, YouScreen,
                            # ChatSheet, IntentionsSheet, ReflectionSheet (World/You)
  ui/                       # design system
    tokens.ts               # 1:1 transcription of docs/design/tokens.md
    motion.tsx              # animation vocabulary (loops, xp-pop, slide, shake)
    Sheet.tsx                # shared bottom-sheet primitive (Chat/Intentions/Reflection)
    ZoneBackground.tsx        # the 4 World zones (Courtyard, Training Ground, Study Veranda, Spring)
    ...components           # GlassCard, Chip, GoldButton, ProgressDots,
                            # PhoneInput, CodeInput, Toggle, ZenBackground,
                            # CompanionAvatar, EnvironmentTile, PersonalityCard,
                            # QuizProgress, ...
```

### Why no router

Onboarding is 8 strictly linear screens ending on a handoff screen; navigation
there is a state-driven step switcher: `OnboardingContext` holds `step` (1-8),
`smsStage` (`phone | verify | handoff`), and the slide direction, with
Continue/Back as reducer actions. Post-onboarding, `WorldContext` holds which
of the two destinations (`world | you`) is active, which sheet (if any) is
open, and the active zone/weather — also a state-driven switch (`KaiziApp.tsx`
renders `WorldScreen` or `YouScreen` off `state.screen`), not a router.
expo-router would add deep links and URL state that nothing in either flow
uses. The rationale is documented in `App.tsx`, `src/state/OnboardingContext.tsx`,
and `src/screens/KaiziApp.tsx`.

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
  The reducer state is already serializable. The session token from
  `verify/check` is likewise not persisted — killing the app after handoff
  currently means re-verifying, not resuming into World/You directly.
- **Phone validation** uses the shared E.164 regex (`^\+[1-9]\d{6,14}$`) plus
  a curated country list instead of libphonenumber; formatting-as-you-type is
  a light grouping, not per-country national formats.
- **Tertiary avatar twitches** (ear flick every 6s, occasional blink) are
  omitted; every species has the whole-figure idle-sway plus its primary
  secondary loop (tail wag, wing flex, mane sway, hair sway, breathing).
- **You → Progress** shows only what the live API can answer today (today's
  kept/total, active-goal count) — no consistency %/total-Growth/monthly-chart
  endpoint exists yet; the panel says so explicitly rather than fabricating
  numbers. **Settings** rows (subscription, notifications, export, reset) are
  similarly display-only with an explicit in-UI note — no
  export/reset/subscription-management endpoints exist yet. Both reassessed
  and confirmed as honest v1 states, not bugs, in the 2026-07-12 final sweep
  (see `kaizi/docs/ep-notes.md`).
- **Zone unlocking is goal-based**, not the streak-earned mechanic
  `world-spec.md` §6 originally described — a zone unlocks immediately once
  its matching onboarding goal is picked, permanently (goals aren't editable
  post-onboarding yet, so this can't regress). See `ep-notes.md`'s
  2026-07-12 entry for why this is judged an acceptable v1 simplification.
- **Never visually verified on a real device or simulator** — every pass to
  date (including 2026-07-12's) has verified `expo export` bundles cleanly
  and that logic/unit tests pass, but no sandbox in this project's history
  has had a device/simulator available to actually watch the zone art,
  weather layers, or sheet animations render.
