# Kaizi — Companion World Spec (v2)

Source mockup: `kaizi/docs/design/kaizi_v2_mockup.html` (founder-provided, approved as
foundation). This doc captures the approved retention mechanics from
`v2-retention-proposals.md` as concrete specs, ready to build against once engineering
work is authorized. **All 7 proposals approved by founder, 2026-07-11.**

---

## 1. Presence-aware return
On opening the app after a gap of 1+ days since last session:
- Compute `daysSinceLastOpen`.
- Select a greeting/dialogue variant from a gap-aware pool instead of the default
  time-of-day greeting — e.g. 1 day: no special copy (normal). 2–4 days: warm
  acknowledgment ("You've been away. The koi missed the noise."). 5+ days: warmer still,
  never negative ("The garden waited. No rush. Tell me where you left off.").
- The world itself (garden state, bloom level, lantern count) never regresses due to
  absence — only dialogue changes. No decay mechanic, ever.

## 2. Companion-initiated speech
While `screen-home` is active and foregrounded, and the companion is not mid-transition:
- After 20–30s of no user interaction, roll a chance (~1 in 3 per idle window) to trigger
  `speak()` with a *contextual* line rather than a random quote from the current activity's
  pool — contextual sources, in priority order: (a) an unkept promise from today, (b) a
  streak milestone reached today, (c) current time-of-day flavor, (d) fallback to the
  existing per-activity quote pool.
- Rate-limit: no more than one unprompted line per session per 5 minutes, so it stays a
  moment, not a nag.

## 3. Memory echoes
- Every Reflection/Identity journal entry is stored with a timestamp (already implied by
  the "memory system" in the original onboarding spec).
- Roughly once every 4–7 days, one companion dialogue slot (chat sheet or idle speech) is
  filled by a "memory echo" — a templated reference to a past entry:
  `"You told me {past_entry_fragment}, back on day {N}. Look at day {current}."`
- Needs a lightweight selection rule: prefer entries that are old (14+ days), not yet
  echoed, and reasonably short (fit the speech-bubble format).

## 4. Home-screen widget *(should-have, not v1)*
- iOS/Android widget rendering current companion activity + time-of-day-synced garden
  background, refreshed a few times daily (not real-time — battery/data cost).
- Flagged as a later milestone; not required for the first living-world build.

## 5. SMS mirrors the living world
- The existing Twilio morning/evening templates (`server/src/services/sms-templates.ts`)
  gain a variable slot for "current world context": time-of-day + current activity id,
  e.g. *"Haru's by the koi pond this morning, wondering about your day."*
- Backend needs to track/derive the companion's "current activity" server-side (or accept
  it's approximate/simulated) so the SMS and the app don't contradict each other.

## 6. Streak-driven world states
Concrete, persisted visual milestones (not just a Journey-screen progress bar):

| Milestone | World change |
|---|---|
| Day 7 | First stone lantern lit (glow appears) |
| Day 14 | Second lantern lit |
| Day 30 | Azaleas bloom (flower-pulse elements become permanent, not just decorative) |
| Day 60 | Koi pond gains a third koi |
| Day 90 | Maple tree turns red (canopy color shift) |
| Day 180 *(reach goal, define later)* | TBD — space for a "full bloom" garden state |

These are **cumulative and permanent** (never reverse on a missed day) — consistent with
proposal #1's no-decay rule. Only forward progress is visualized.

## 7. Optional anonymized consistency leaderboard
- Opt-in only, off by default.
- Ranks by consistency % (not raw streak length or total Growth), so a returning or new
  user isn't structurally at the bottom.
- No real names or photos — display handle + companion name only.
- Lower priority than 1–6; not required for the first living-world build.

---

## Explicitly out of scope (ruled out)
- Decay/punishment mechanics (sad companion, dying garden, guilt-based copy).
- Streak-loss panic notifications or urgency dark patterns.

---

## Status
Spec approved. Engineering build (Expo screens, backend activity/state tracking) not yet
started — awaiting founder go-ahead. Current active workstream: elevating garden/companion
animation quality (see Motion & Environment Designer output, `kaizi_v2_enhanced.html`).
