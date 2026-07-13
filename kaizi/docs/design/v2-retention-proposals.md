# Kaizi v2 — Retention Proposals

Source mockup: `kaizi/docs/design/kaizi_v2_mockup.html` (saved, not yet built).

This mockup is a real leap: Home is no longer a static mission list, it's a **living world** —
Haru wanders between activities, the sky cycles through time of day, and he reacts when you
tap him or keep a promise. That's the single biggest retention lever a companion app has:
the pull to "check in on someone," not "check off a list." The proposals below are aimed at
sharpening that pull, not adding scope for its own sake. Each is independent — approve,
reject, or edit any line.

Mark each with your call: **[ ] approve** / **[ ] reject** / **[ ] approve with changes: ...**

---

## 1. Presence-aware return, never guilt-trip
Right now nothing in the mockup shows what happens if you're gone two days. The two failure
modes to avoid: (a) the world looks exactly the same as if you'd never left — no pull to
return; (b) a Tamagotchi-style "he's sad/sick because you abandoned him" — proven to spike
uninstalls in self-improvement apps because it turns the companion into a source of guilt.

**Proposal:** On return after a gap, Haru's *greeting* and *one line of dialogue* acknowledge
the gap warmly ("You've been away. The koi missed the noise." / "The garden waited. No rush.")
— but the world itself never visibly decays. Presence is emotional, not punitive.
`[ ]`

## 2. Companion-initiated moments, not just tap-to-speak
Every interaction in the mockup is user-initiated (tap Haru, open chat). A relationship that
only speaks when spoken to feels like a toy, not a companion. Tamagotchi's actual engagement
loop is the creature having needs/moments independent of your input.

**Proposal:** While the app is open and idle for ~20–30s, there's a small chance Haru's
speech bubble appears on its own with a contextual line (referencing your streak, the time
of day, or an unkept promise) — same visual system already built, just companion-initiated
instead of tap-initiated.
`[ ]`

## 3. Memory echoes — the companion remembers, visibly
The original product thesis is long-term memory as the moat. This mockup's chat is static
demo copy. The cheapest, highest-leverage version: once every few days, Haru's dialogue
references something specific the user wrote in Reflection or Identity weeks earlier
("You told me discipline scared you, back on day 12. Look at day 94.").

**Proposal:** Add a "memory echo" line type to the companion's dialogue pool, pulled from
past journal/reflection entries, surfaced occasionally in the world or in Reflection.
`[ ]`

## 4. Home-screen widget: the companion exists outside the app
The single strongest lever for "check in whenever" apps (Animal Crossing, Tamagotchi,
BitLife) is a widget — seeing your companion doing something *right now* without opening
the app pulls people back far more than a push notification does.

**Proposal:** A small iOS/Android widget showing Haru's current activity + time-of-day-synced
garden, updating a few times a day. (Bigger lift than the others — flagging as a
should-have, not a v1 must-have.)
`[ ]`

## 5. SMS content mirrors the living world
You already committed to Twilio SMS as the companion's channel. Right now that's
conceptually separate from the in-app world. Tying them together reinforces the illusion of
one continuous companion instead of "app" + "generic reminder texts."

**Proposal:** The morning/evening SMS references what Haru is doing in-world right now
("Haru's by the koi pond this morning, wondering about your day") instead of a generic
check-in line. Low effort — it's the same template system already built, seeded with the
current time-of-day/activity.
`[ ]`

## 6. Streak visibly changes the world, not just a stat
Journey already says "Garden level 8 · Azaleas in bloom" — the world growing with your
consistency is already the plan. Worth making explicit and locking in as a real mechanic
rather than mockup flavor text.

**Proposal:** Define 4–5 concrete world states tied to consistency/streak milestones (e.g.
day 7: first lantern lit; day 30: azaleas bloom; day 90: maple turns red — literally in the
mockup's copy already) that are real, persisted visual changes to the Companion World, not
just a Journey-screen progress bar.
`[ ]`

## 7. Optional, anonymized consistency leaderboard
Your original spec called for a "Consistency % × XP leaderboard." Not in this mockup.
Leaderboards are a strong retention lever but a real risk in a self-improvement app —
comparison anxiety can backfire against the identity-transformation thesis.

**Proposal:** Add it as strictly opt-in, anonymized (no real names/photos), and framed
around consistency percentage rather than raw streak length so a returning user isn't
instantly at the bottom. Low priority — flag only.
`[ ]`

---

## Not proposing (explicitly ruled out)
- **Decay/punishment mechanics** (companion looking sad, garden dying) — retention research
  on self-improvement apps consistently shows shame-based hooks increase short-term opens
  but increase churn and are actively hostile to the "trusted companion" positioning.
- **Push notification spam / streak-loss panic alerts** — same reasoning; Kaizi's own spec
  already prioritizes emotional connection over dark-pattern urgency.

---

Once you mark these up, tell me which are approved and I'll fold them into
`kaizi/docs/design/onboarding-spec.md`'s sibling doc (a new `world-spec.md`) before any
building starts — per your instruction, nothing gets built yet.
