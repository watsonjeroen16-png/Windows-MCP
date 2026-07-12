# Kaizi — Personalization Spec: Onboarding Quiz, Screen-Time Opt-In, and AI-Generated Intentions

Author: AI Engineer / Product · Status: **planning only, not approved** — this document is what the
founder reviews to approve or redirect the work. Nothing here has been built; no onboarding screen,
server route, or migration described below exists yet. Do not build against this doc without an
explicit go-ahead.

Founder's verbatim request: *"i want the companion to be able to track data throughout the phone if
the user selects allow in the onboarding and in the onboarding you take a small 10 question quiz on
your goals and other stuff so your companion knows more about you and can actually generate
personalized daily intentions for you."* Phone-data scope, per follow-up: **app usage / screen time
only** — no location, no calendar, no contacts. Opt-in via a toggle presented during onboarding.

Source context read before writing this: `docs/design/onboarding-spec.md` (shipped 7-screen flow),
`docs/design/tokens.md` (visual language), `docs/design/world-spec.md` and
`docs/design/app-restructure-v3.md` (Companion World / Intentions), `server/src/services/claude-chat.ts`
(the real Claude API integration this feeds into), `server/src/db/migrations/001_init.sql` and
`002_companion_world.sql` (existing schema shape), `server/src/routes/intentions.ts` (the Intentions
API this personalizes).

**Note on scope conflict with `app-restructure-v3.md`:** that doc states *"Onboarding — zero changes
to `onboarding-spec.md` or its 7-screen flow. It's shipped, tested, and out of scope per the brief."*
That was true for the v3 restructure brief. This is a **separate, later founder request** that
explicitly reopens onboarding. The two docs are not in conflict — v3 just predates this ask — but
flagging it so nobody reads both and gets confused about whether onboarding is frozen. It isn't,
pending this approval.

---

## 0. Summary of decisions (read this first)

| Decision | Choice | Why |
|---|---|---|
| Quiz placement | New step, **after Identity Input ("Why"), before Companion Selection** | Preserves the existing Goals→Why emotional arc untouched; quiz reads as "getting to know you further" right after the user's most vulnerable disclosure, before the fun/creative companion-building screens. See §1.1. |
| Quiz screen count | **1 new onboarding step** (one dot in ProgressDots), containing an internal 10-card swipeable sequence with its own secondary progress indicator | Matches the existing precedent of SMS Setup being "step 7" with 3 internal sub-screens (7a/7b/7c) — doesn't inflate the global step count by 10. |
| Quiz question format | All chip-based (single- or multi-select), zero free text, all skippable | Founder's own instruction: must not kill onboarding completion. |
| Screen-time consent | **1 new onboarding step**, separate from the quiz, own dedicated screen | A permission grant deserves its own gravity — same treatment as phone verification, not a quiz question. |
| Screen-time consent placement | Immediately after the quiz | Groups the two new "tell us more about you" steps together, bookended by Why (before) and Companion (after). |
| Default state of the toggle | **Off** | Explicit opt-in, not a pre-checked box — this is the founder's own "no dark patterns" standard applied to the one new ask that could violate it. |
| Decline path | Fully functional app, zero nag, zero re-prompt loop | A real decline, not a soft-gated one. |
| **iOS feasibility** | **Real, significant risk — flagged for founder decision before any engineering commitment.** Apple's Screen Time / Family Controls API does not hand third-party apps raw per-app usage numbers for export to a server; it renders a report inside a sandboxed extension the host app can't read. Coarse threshold *events* are the only thing that reliably crosses the sandbox. See §2.3. | This is the single fact most likely to change the founder's mind about scope, timeline, or whether to ship Android-only first. |
| Android feasibility | Directly usable via `UsageStatsManager`, gated behind a manual "Usage Access" grant in system Settings (not a runtime permission dialog) | Existing, stable, public API — the more feasible platform by a wide margin. |
| New onboarding screen total | **7 → 9** steps | A real completion-rate risk in its own right — flagged in §1.4 regardless of the iOS question. |
| DB additions | 3 new tables: `onboarding_quiz_responses`, `permission_consents`, `screen_time_daily_summary` — additive only, no existing table touched | Mirrors the additive-migration convention already used in `002_companion_world.sql`. |
| Claude API integration | New "user profile digest" system block inserted into the existing `claude-chat.ts` cache-breakpoint pattern; quiz-derived content is cache-*stable*, screen-time content is cache-*volatile* | Reuses the architecture already decided in `world-build-plan.md` rather than inventing a second pattern. See §3. |

---

## 1. The 10-question onboarding quiz

### 1.1 Where it slots in, and why

Current shipped flow (`onboarding-spec.md`):

```
Welcome(1) → Goals(2) → Why(3) → Companion(4) → Personality(5) → Environment(6) → SMS(7a/7b/7c)
```

Three candidate insertion points were considered:

1. **Between Goals(2) and Why(3).** Rejected. It would interrupt the flow's best emotional beat —
   selecting goals and then immediately being asked "why are you doing this" is the strongest
   sequence in the current build. Inserting ten quiz questions between them dilutes momentum right
   as it's building.
2. **Between Personality(5) and Environment(6).** Rejected. One quiz question (support style) would
   sit suspiciously close to, and partially redundant with, Personality Selection just before it —
   see the redundancy note below. Placing the quiz there also breaks up the three "meet your
   companion" screens (Companion/Personality/Environment), which currently read as one continuous,
   fun stretch.
3. **Between Why(3) and Companion(4). Chosen.** The Goals→Why arc stays completely intact. The quiz
   becomes a natural continuation of "getting to know you" immediately after the user's most
   emotionally honest input, before the tone shifts to the lighter, creative work of building their
   companion. It also means quiz answers are available in time to (optionally) highlight a
   recommended personality on Screen 5+2, mirroring the existing "BEGIN HERE" recommended-default
   treatment already used on the Environment screen's Japanese Garden tile — a nice-to-have, not a
   requirement of this phase.

**Redundancy note — support style vs. Personality Selection.** The founder's own list of quiz topics
includes "preferred support style (gentle nudges vs. direct accountability vs. celebratory)." That
axis looks a lot like Personality Selection (Coach/Tough Love/Mentor/Supportive/Rival), which already
exists as Screen 5. They are **not actually the same thing** and this spec keeps both, deliberately:

- **Personality Selection (existing)** picks the companion's conversational *voice* — how they sound
  when they talk to you, forever, across every chat message.
- **Quiz support-style question (new)** picks the *cadence and intensity of accountability nudges* —
  how hard the companion pushes when you're behind, independent of tone. A user can pick "Supportive"
  as a voice and still want direct, no-sugar-coating accountability nudges; the two axes are
  genuinely separable and both feed different parts of the personalization pipeline (voice → chat
  system prompt, cadence → intention-generation tone). The quiz question is phrased to make this
  distinction clear (see Q4 below) rather than re-asking "who do you want as a coach."

### 1.2 Screen flow sketch

One new onboarding step (call it **Screen 3.5** in planning shorthand; it becomes the real Screen 4
once built, renumbering everything after it — see §1.4). Internally it is **not** ten separate global
onboarding steps — it's a single step containing a swipeable card sequence, same pattern as how SMS
Setup's step 7 already contains three sub-screens (7a/7b/7c) under one dot.

**Layout, once per card:**

1. Chrome: back chevron (goes to previous *card*, not previous onboarding screen, until card 1 — then
   exits the whole quiz step back to Why); global ProgressDots stay fixed at this step's dot (no
   dot-per-question — a secondary indicator handles in-quiz progress, see below).
2. Secondary progress: a slim horizontal bar or "3 of 10" counter (`type.meta`, `text.faint`) below
   the eyebrow — distinct from the global ProgressDots so ten questions don't visually inflate the
   whole onboarding's perceived length.
3. Header: eyebrow (`type.micro`) + question title (`type.title`, serif 28, cream) + optional short
   subtitle if the question needs a one-line frame (`type.subSerif` italic, sand).
4. Chip field: single- or multi-select chips, same `Chip` component and states as Screen 2's goal
   chips. Tapping a single-select chip **auto-advances** to the next card after a brief `xp-pop`
   (~350ms), Duolingo/quiz-style — no explicit "Continue" tap needed for most questions, which is
   what keeps ten questions feeling fast rather than laborious. Multi-select questions (Q5, time
   availability) keep an explicit "Continue" CTA since there's no single tap that means "done."
5. Skip affordance: small text link under the chips, `type.meta` `text.faint` — **"Skip this
   question"** — advances without recording an answer. Additionally, a **"Skip quiz"** text link sits
   in the header on card 1 only, exiting the whole step immediately with zero answers recorded.
6. On the 10th card's answer (or on "Skip quiz"): brief confirmation state — "Got it, that helps" or
   similar in-voice line — then advance to Screen-Time Consent (§2).

**Background:** `ground.panel`, no scenery — same treatment as Personality Selection, since the cards
themselves are the scene, and it keeps a tonal throughline between "we're getting to know you" moments
in the flow.

**New components needed** (additions to the existing `app/src/ui/` inventory in `onboarding-spec.md`):

| Component | Props (sketch) | Notes |
|---|---|---|
| `QuizCard` | `question, options, selectionMode: 'single'\|'multi', selected, onSelect, onSkip` | Reuses `Chip`; auto-advance on single-select tap |
| `QuizProgress` | `current, total=10` | Slim bar or "{n} of 10" counter, `type.meta` |

### 1.3 The 10 questions

All chip-based, all skippable, tone matches `onboarding-spec.md`'s existing dialogue voice guidelines
(short eyebrow, serif title as the real question, no clinical/survey language). None of these are
styled as companion speech (no chat bubble, no `type.voice` italic) — the companion hasn't been chosen
yet at this point in the flow (Companion Selection is the *next* screen), so this is the app's own
voice, same register as Screen 2 and Screen 3.

---

**Q1 — Focus goal**
Eyebrow: **GETTING TO KNOW YOU**
Title: **"Of what you're building, what matters most right now?"**
Options (dynamic — populated from the user's `goals[]` picked on Screen 2, plus a catch-all): the
user's selected goals as chips (e.g. `Fitness`, `Discipline`) + **`All of it, equally`**
Selection: single-select, auto-advance

**Q2 — Starting point**
Eyebrow: **YOUR STARTING LINE**
Title: **"Where are you starting from?"**
Options: `Just starting out` · `Restarting after a break` · `Consistent, want to level up` · `Already disciplined, refining the details`
Selection: single-select, auto-advance

**Q3 — Biggest obstacle**
Eyebrow: **BE HONEST**
Title: **"What gets in your way most?"**
Options: `Motivation dips` · `Not enough time` · `Don't know where to start` · `Distractions — phone, social media` · `Self-doubt` · `Inconsistency`
Selection: single-select, auto-advance

**Q4 — Support style / accountability cadence**
Eyebrow: **HOW WE PUSH**
Title: **"When you're behind, how do you want to hear it?"**
Subtitle (clarifying the distinction from Personality Selection): *"This is about how hard we push — you'll pick their voice next."*
Options: `A gentle nudge` · `Direct — no sugar-coating` · `Celebrate the wins, skip the guilt` · `Mostly hands-off — I'll ask when I need it`
Selection: single-select, auto-advance

**Q5 — Time-of-day availability**
Eyebrow: **YOUR SCHEDULE**
Title: **"When are you usually free to focus?"**
Options (multi-select): `Early morning` · `Midday` · `Evening` · `Late night` · `It varies day to day`
Selection: multi-select, min 1 — explicit **"Continue"** CTA (goldButton quiet, same disabled-until-selected recipe as Screen 2)

**Q6 — Motivation style**
Eyebrow: **WHAT DRIVES YOU**
Title: **"What actually keeps you going?"**
Options: `Discipline & routine` · `Progress I can see` · `Someone in my corner` · `A little competition`
Selection: single-select, auto-advance

**Q7 — Past attempts**
Eyebrow: **NO JUDGMENT**
Title: **"Have you tried something like this before?"**
Options: `Never really tried` · `Tried apps or trackers, didn't stick` · `Tried with a person — coach, friend — and it helped` · `I know what works, I just don't do it`
Selection: single-select, auto-advance

**Q8 — Confidence baseline**
Eyebrow: **BE HONEST, AGAIN**
Title: **"How confident do you feel about actually sticking with this?"**
Options: `Not very` · `Somewhat` · `Fairly` · `Very`
Selection: single-select, auto-advance

**Q9 — Ideal rhythm**
Eyebrow: **YOUR RHYTHM**
Title: **"What's your natural rhythm?"**
Options: `Same routine daily` · `Flexible, different every day` · `Structured weekdays, loose weekends`
Selection: single-select, auto-advance

**Q10 — 90-day vision**
Eyebrow: **LOOKING AHEAD**
Title: **"In 90 days, what would feel like a real win?"**
Options: `A streak I'm proud of` · `A result I can measure` · `Feeling back in control` · `Proof I can follow through`
Selection: single-select, auto-advance → triggers the end-of-quiz confirmation state, then navigates
to Screen-Time Consent

---

### 1.4 Onboarding step-count impact (flag this explicitly)

Total onboarding steps go from **7 to 9** (Quiz + Screen-Time Consent are both new top-level steps).
This is a real completion-rate risk independent of the iOS question in §2.3 — every additional screen
in a mobile onboarding flow measurably drops completion, and this spec adds two. Mitigations already
built into the design above: full skippability (per-question and whole-quiz), auto-advance on
single-select (minimizes taps), and a genuinely no-cost decline on the permission screen. Recommend
the founder treat post-launch completion-rate monitoring on steps 4–5 (the two new steps) as a
required metric, not a nice-to-have, and be open to cutting the quiz to fewer questions if funnel data
says so — this spec's 10 questions are a starting proposal, not a number to defend for its own sake.

New flow:

```
Welcome(1) → Goals(2) → Why(3) → Quiz(4, 10 internal cards) → ScreenTimeConsent(5)
  → Companion(6) → Personality(7) → Environment(8) → SMS(9a/9b/9c)
```

### 1.5 Data model sketch (planning only — no migration written)

Following the existing convention in `001_init.sql` (`onboarding_profiles` is one row per user, typed
columns for the fields collected on Screens 2–6): a normalized column per question would work but
locks the schema to today's exact 10 questions — any future wording tweak or added question needs a
migration. Given quiz answers primarily feed a text digest into a Claude system prompt (§3) rather
than needing per-question SQL filtering/analytics right now, a JSONB blob is the better trade-off for
this phase; recommend revisiting with normalized columns or generated columns only if/when the founder
wants per-question analytics dashboards.

```sql
-- Sketch only, not a migration.
CREATE TABLE IF NOT EXISTS onboarding_quiz_responses (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    quiz_version smallint NOT NULL DEFAULT 1,   -- bump when question wording/set changes
    answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- shape: { "focusGoal": "fitness", "startingPoint": "restarting",
    --          "obstacle": "distractions", "supportStyle": "direct",
    --          "availability": ["morning", "evening"], "motivationStyle": "results",
    --          "pastAttempts": "triedAppsDidntStick", "confidence": "fairly",
    --          "rhythm": "flexible", "ninetyDayVision": "measurableResult" }
    -- unanswered/skipped questions are simply absent from the object, not null-valued
    skipped_entirely boolean NOT NULL DEFAULT false,  -- true if "Skip quiz" was tapped on card 1
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 2. Screen-time opt-in permission

### 2.1 What the consent screen says (plain language, no dark patterns)

New onboarding step, own dedicated screen, positioned right after the quiz (§1.4). This is a
permission grant, not a quiz question — it gets the same visual weight as the phone-verification
screen (Screen 9a), not a chip card.

**Layout:**

1. Chrome (back, dots at this step).
2. Header:
   - Eyebrow: **"ONE MORE THING — OPTIONAL"** (the word "optional" belongs in the eyebrow itself, not
     buried in body copy)
   - Title (`type.title`, serif 28, cream): **"Let your companion notice your screen time?"**
   - Subtitle (`type.subSerif` italic, sand): **"This helps them shape your daily intentions around real patterns — not guesses."**
3. Plain-language explanation body (`type.bodySans`, `text.body`, NOT styled as companion chat speech —
   this is the app talking directly, not a character, consistent with keeping consent language
   unambiguous rather than voiced-in-character):
   > "If you say yes, Kaizi reads your phone's built-in screen-time totals — how much time you spend
   > in which apps, nothing else. We never see message content, browsing history, contacts, photos,
   > or your location. You can turn this off any time in Settings, and nothing about your companion
   > changes if you skip it."
4. Toggle row (glassSubtle card, mirrors the Screen 9a toggle-group pattern):
   - Label: **"Share screen time"** / Sub-label: **"App usage totals only — nothing else"**
   - **Default: OFF.** This is a deliberate change from a literal reading of the founder's "if the
     user selects allow" — the founder's own house style (see `world-spec.md`'s "explicitly out of
     scope: dark patterns") rules out a pre-checked opt-in. Off-by-default with an explicit tap to
     enable is the only reading of "no dark patterns" that's internally consistent with the rest of
     this app's stance.
   - **Android-specific behavior when toggled on:** the app deep-links to the system "Usage Access"
     settings screen (see §2.4) rather than showing an in-app permission dialog, because that's the
     only mechanism Android exposes for this permission. Microcopy directly beneath the toggle when
     on Android: *"This opens your phone's Usage Access settings — find Kaizi in the list and turn it
     on, then come back here."*
   - **iOS-specific behavior:** see §2.3 — this is the platform where the toggle's actual behavior is
     an open engineering question, not a settled UX flow. Do not build the iOS side of this toggle
     until §2.3's spike (below) resolves what's actually obtainable.
5. Footer CTA: **"CONTINUE"** — **always enabled, regardless of toggle state.** This is the concrete
   mechanism that makes the decline "real": there is no gate, no re-prompt, no second screen asking
   "are you sure." Toggling off and tapping Continue is a complete, first-class path through
   onboarding.
6. Footer microcopy: **"Your companion works great either way — this just makes it a little sharper."**
   (`type.subSerif` italic, `text.faint`) — states plainly that decline has no functional cost,
   because it doesn't: intention generation without screen-time data still runs off the quiz +
   goals + identity_why digest (§3), just without the usage-pattern layer.

**Background:** `ground.base` + ambient variant, consistent with the lower-ceremony informational
screens elsewhere in onboarding (not the higher-ceremony `ground.night` used for the Why screen — this
is a permission ask, not an emotional disclosure).

### 2.2 What happens on decline

- No functional degradation to chat, quiz-driven personalization, goals, or any other feature.
- `permission_consents.screen_time_opt_in` is stored as `false` (see §2.5) — recorded, not skipped
  silently, so the backend knows definitively not to attempt any screen-time read and doesn't need to
  keep re-asking.
- The companion's daily-intention generation (§3) simply omits the screen-time digest block from its
  prompt — the rest of the personalization pipeline (quiz + goals + identity_why) runs unchanged.
- **No re-prompt loop.** The toggle remains available later in Settings (You → Settings, per
  `app-restructure-v3.md`'s restructure) for a user who changes their mind, but onboarding itself never
  asks again.

### 2.3 Platform feasibility — the risk the founder needs to see

This is the most important technical judgment call in this document, and it is genuinely uneven
across platforms. Flagging it prominently rather than presenting a unified "screen-time toggle" as if
it works the same way everywhere would be dishonest about the actual engineering cost.

**Android — feasible, well-understood.** `UsageStatsManager` (`android.app.usage`) is a stable, public
API that returns real per-app foreground-usage aggregates (`queryUsageStats()` / `queryEvents()`,
daily/weekly/monthly buckets). It's gated behind the `PACKAGE_USAGE_STATS` permission, which is a
**"special app access"** grant — the user must manually enable it via Settings → Apps → Special app
access → Usage access, reached by deep-linking to
`Settings.ACTION_USAGE_ACCESS_SETTINGS`. It is **not** a normal runtime permission dialog (no
`ActivityCompat.requestPermissions()` popup) — the app cannot show its own in-app "Allow" button that
grants it directly; it can only send the user to the right settings page and detect on return whether
the grant happened. Once granted, actual per-app usage minutes are directly queryable and can be
aggregated server-side. This is the flow described in §2.1's Android microcopy.

**iOS — genuinely constrained, needs a feasibility spike before any engineering commitment.** Apple's
relevant framework is **Screen Time API** (`FamilyControls`, `ManagedSettings`, `DeviceActivity`,
introduced iOS 16), which does support requesting authorization for the **device owner's own** usage
(`AuthorizationCenter.shared.requestAuthorization(for: .individual)`) — this is not purely a
parental-control mechanism, despite the framework's origin and continued primary use case being
Family Sharing / guardian-managed devices. The real constraint is different: **the framework is
designed so the host app cannot read raw per-app usage numbers directly.** Usage data is rendered
through a `DeviceActivityReport` SwiftUI extension that runs in a separate, privacy-sandboxed process
— the extension can *display* a usage report to the user, but the numbers it renders are not exposed
back to the main app's code, and are not something the app can serialize and send to a server for the
kind of AI-driven aggregation this feature needs. The one mechanism that *does* cross the sandbox
boundary is `DeviceActivityMonitor` **threshold events** — coarse, pre-declared triggers like "user
crossed 60 minutes in the Social category today," fired as a callback, not a queryable "give me exact
minutes for every app" API. That's a meaningfully different (and much less rich) capability than what
Android's `UsageStatsManager` provides, and it's a poor fit for feeding a nuanced "here's what your
day looked like" digest into an AI prompt.

**What this means concretely:**
- A literal "screen time" feature parity with Android is **not straightforwardly achievable on iOS**
  with public APIs as designed. This is an intentional Apple privacy boundary, not a gap that will
  close with more engineering effort.
- The realistic iOS-feasible version is coarser: a small number of pre-declared category thresholds
  (e.g., "did the user cross 2 hours of social media today: yes/no") rather than the rich per-app
  numeric digest Android can produce.
- **Recommendation: before committing engineering time to iOS screen-time integration, run a short
  technical spike** (a throwaway `DeviceActivityReport`/`DeviceActivityMonitor` prototype) to confirm
  current framework behavior firsthand rather than trusting this document's description indefinitely —
  Apple has adjusted this framework's boundaries before and may again, and this analysis reflects
  publicly documented behavior as of this writing, not a live-verified state.
- **Founder decision needed:** ship Android-only for v1 of this feature and revisit iOS after the
  spike, or ship both platforms with iOS deliberately scoped down to threshold events, or hold the
  entire feature until iOS parity is confirmed feasible. This spec does not make that call — it's
  flagged here specifically because it changes scope, timeline, and possibly the UX in §2.1's iOS
  toggle behavior.

### 2.4 Data minimization — what actually gets stored

Regardless of platform, store **aggregates only**, never a raw per-minute or per-app timeline:

- Daily total screen-time minutes.
- Daily top 1–2 usage categories (e.g., "Social", "Entertainment") and their minutes, where the
  platform can produce a category (Android can; iOS threshold events are category-scoped by design).
- No per-app-name-level granularity retained server-side unless a future, explicitly-approved feature
  needs it — the personalization use case (§3) only needs "were they on their phone a lot today, and
  in what general category" as a tone input, not a forensic log.

### 2.5 Data model sketch (planning only)

```sql
-- Sketch only, not a migration.
CREATE TABLE IF NOT EXISTS permission_consents (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    screen_time_opt_in boolean NOT NULL DEFAULT false,
    screen_time_opt_in_at timestamptz,
    screen_time_platform text CHECK (screen_time_platform IN ('ios', 'android')),
    screen_time_revoked_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Aggregate-only daily digest. Populated by a device-side sync job that reads
-- UsageStatsManager (Android) or DeviceActivityMonitor threshold events (iOS,
-- pending the §2.3 spike) and posts a rollup — never raw per-app timelines.
CREATE TABLE IF NOT EXISTS screen_time_daily_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    summary_date date NOT NULL,
    total_minutes integer NOT NULL,
    top_category text,
    top_category_minutes integer,
    source text NOT NULL CHECK (source IN ('android_usage_stats', 'ios_threshold_event')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, summary_date)
);

CREATE INDEX IF NOT EXISTS screen_time_daily_summary_user_id_date_idx
    ON screen_time_daily_summary (user_id, summary_date);
```

---

## 3. Feeding quiz + screen-time data into personalized daily intentions

### 3.1 What exists today

`server/src/services/claude-chat.ts` is the one real Claude API integration in the codebase today —
it powers companion **chat replies**, not intention generation. Its architecture, per its own header
comment and confirmed by reading the file:

- `client.messages.create()`, single-turn, model `claude-opus-4-8`, `max_tokens: 300`, no `thinking`.
- System prompt is **two blocks**: a stable block (companion identity + personality voice) with
  `cache_control: { type: "ephemeral" }`, followed by a volatile block (the `memoryDigest` — goals,
  identity "why", today's unkept intentions) with no cache marker, per the documented rule "stable
  content before the breakpoint, volatile content after."
- Mock mode when `ANTHROPIC_API_KEY` is unset, matching `services/twilio.ts`'s convention.

There is currently **no dedicated daily-intention-generation service** — `routes/intentions.ts` is
plain CRUD (create/list/keep an intention), with no AI call in it at all. "The current generic pool"
the founder referred to is presumably a static/hand-authored set the client or a seed picks from
today; this section specs the new AI-generation call that replaces it, designed to reuse the same
architectural pattern already decided for chat rather than inventing a second one.

### 3.2 New service: intention generation

A new sibling service — `server/src/services/intention-generator.ts` (name only; not built) — that:

- Runs on a schedule (e.g., nightly per-user, or on-demand when a user opens the world with no
  intentions yet for today — implementation detail for a later build spec, not decided here).
- Calls `claude-opus-4-8`, same as chat, for architectural consistency and because generating good,
  identity-aware intentions is exactly the kind of judgment call that benefits from the more capable
  model — this is not a place to reach for a cheaper model without the same explicit founder sign-off
  `claude-chat.ts`'s own comment already requires.
- Uses **structured output** (`output_config.format` with a JSON schema) instead of free text, so the
  response maps directly onto the existing `createIntentionSchema` shape in `routes/intentions.ts`
  (`title`, `subtitle`, `rewardGrowth`, implicitly `scheduledFor` = today) — this avoids a fragile
  "parse the model's prose into an intention" step entirely. Concretely: request N intentions
  (2–3, TBD by product) as a JSON array matching that field shape.

### 3.3 System prompt structure — extending the existing cache-breakpoint pattern

The founder specifically asked whether a "user profile digest" block should sit before or after the
existing cache-caching breakpoint, and whether it's cacheable-stable or per-session-volatile. The
honest answer is **it's two different blocks with two different cacheability profiles**, and where
each goes depends on *which* call it feeds — chat (frequent, many calls/day) or intention generation
(infrequent, ~once/day). These behave differently enough under Anthropic's prompt-caching rules that
naively bolting one new block onto the existing chat prompt is the wrong move without splitting it.

**Quiz-derived profile digest — cacheable-stable.** Quiz answers change only when a user retakes the
quiz (not built in this phase, but the schema in §1.5 doesn't preclude it later) or edits their
companion/goals. That's rare — this content is stable across a huge number of chat turns per user, so
it's exactly the kind of content `cache_control: { type: "ephemeral" }` is for.

**Screen-time digest — per-session/per-day volatile, never cached.** Changes daily by definition
(that's the whole point of the feature). Caching it would either miss every time (paying the ~1.25x
write premium for zero reads) or, worse, silently keep serving yesterday's screen-time framing if a
TTL outlived the intended freshness window. This block belongs **after** the last cache breakpoint,
same place `memoryDigest` (today's unkept intentions, etc.) already lives.

**Recommended structure for the companion CHAT prompt (`claude-chat.ts`), extending its existing
two-block system array to three:**

```
system: [
  { type: "text", text: stableBlock,        cache_control: { type: "ephemeral" } },  // unchanged: companion identity + voice
  { type: "text", text: quizProfileDigest,  cache_control: { type: "ephemeral" } },  // NEW: quiz answers digest, its own breakpoint
  { type: "text", text: volatileBlock },                                            // memoryDigest + screen-time digest, no cache_control
]
```

Two breakpoints (well under the API's 4-breakpoint-per-request max), each caching everything up to
that point — the quiz-digest breakpoint caches identity+voice+quiz together, so a chat turn that only
changed today's unkept-intentions list (the truly volatile part) still gets a cache **read** on
everything before it.

**A concrete technical catch worth flagging:** Anthropic's minimum cacheable-prefix length for
`claude-opus-4-8` is **4096 tokens** — a shorter prefix silently does not cache at all (no error,
`cache_creation_input_tokens: 0`). Reading `buildStableSystemBlock()` in the current file, that block
is a handful of short sentences — very likely **under** that 4096-token floor today, meaning the
existing `cache_control` marker on it may not actually be producing any cache reads in production
right now. Adding the quiz-derived profile digest (goals detail, obstacle, support style, motivation
style, etc. — naturally a few hundred more tokens of text) as a second breakpoint after it has a
useful side effect: it's likely to push the combined stable prefix over the 4096-token threshold for
the first time, making the caching this codebase already believed it had start actually working. This
is worth verifying with `usage.cache_read_input_tokens` on both the current code and the new version
before/after shipping this change, rather than assuming either one is caching correctly.

**Recommended structure for the new intention-generation call.** Different frequency profile — likely
once/day/user, not many times/day — so per-user caching mostly doesn't pay off (a 5-minute or even
1-hour TTL won't span the gap between one user's nightly runs). Two things still worth doing:

1. Keep a **shared, user-agnostic instructions block** (the task description: "generate N daily
   intentions in this JSON shape, following these principles...") as the first, cacheable system
   block. This is byte-identical across every user's generation call, so if the nightly job runs many
   users' generations close together in time (e.g., a batch window, or via the Message Batches API),
   this block can realistically get cache reads across users, not just within one user's repeated
   calls. This is the one part of the intention-generation prompt where caching earns its keep.
2. Don't bother marking the per-user profile block (quiz + screen-time + goals + identity_why) with
   `cache_control` for this call path unless product later adds an on-demand "regenerate today's
   intentions" feature that calls this multiple times in quick succession for the same user — until
   then it's a write cost with no matching read.

### 3.4 What goes in the quiz-derived digest (concrete content, not just "quiz answers")

A short, model-readable paragraph built server-side from `onboarding_quiz_responses.answers` (§1.5) —
not the raw JSON — e.g.:

> "This user is focused on {focusGoal}, starting from '{startingPoint}'. Their biggest obstacle is
> {obstacle}. They want accountability delivered as: {supportStyle}. They're usually free to focus
> {availability}. What keeps them going: {motivationStyle}. Past attempts: {pastAttempts}. Confidence
> level: {confidence}. Natural rhythm: {rhythm}. A 90-day win looks like: {ninetyDayVision}."

Missing/skipped fields are simply omitted from the sentence, not rendered as "unknown" — keeps the
digest natural-language and avoids training the model on a placeholder pattern.

### 3.5 What goes in the (volatile) screen-time digest, when opted in

A one- or two-sentence summary derived from `screen_time_daily_summary`, deliberately coarse and
non-judgmental in tone (consistent with `world-spec.md`'s explicit no-guilt stance — this must never
read as a scold):

> "Yesterday this user spent about {total_minutes} minutes on their phone, mostly in {top_category}.
> Use this only as a light signal, never to guilt or lecture — if relevant, it might mean today's
> intentions lean toward a small, achievable win rather than an ambitious one."

That last sentence is doing real work: it's an explicit instruction to the model to treat screen-time
as a *supportive* signal (maybe scale ambition down on a rough day) rather than material for the
companion to comment on directly, which would risk feeling surveilled rather than supported — the
opposite of what this whole feature is for.

---

## 4. Open questions for founder review

1. **iOS screen-time feasibility (§2.3) — the big one.** Ship Android-only first, scope iOS down to
   threshold events, or hold the feature until a spike confirms current framework behavior?
2. Is 10 questions the right number, or should the quiz start smaller (e.g., 6) and grow based on
   completion-rate data once live?
3. Number of intentions to generate per day (2–3 assumed in §3.2, not decided) — a product call, not
   an engineering one.
4. Does the founder want an in-app "retake the quiz" affordance later (You → Settings), or is the
   quiz meant to be a one-time onboarding artifact? Affects whether `quiz_version` in §1.5's schema
   sees real use soon or stays vestigial.

---

## Status

Planning only. Not approved. No onboarding Expo screen, server route, or migration described in this
document has been written. This spec is the artifact for founder review — approve, redirect, or
descope (most likely candidate: the iOS screen-time question in §2.3) before any implementation work
begins.
