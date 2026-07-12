# Kaizi v3 — App Restructure & Garden Depth

Author: Retention Architect · Date: 2026-07-12
Founder ask: *"the whole structure of the app has to change,"* plus *"more depth to the
garden."* Not a re-skin — an information-architecture rethink, grounded in what's already
been learned building v2 (the living-world Home is the single strongest retention lever
this product has) and in the working backend surface (`world-build-plan.md`).

Companion mockup: `kaizi/docs/design/kaizi_v3_mockup.html`. Nothing here is built — this is
the proposal the mockup demonstrates, for founder approval before any `kaizi/app` or
`kaizi/server` code is touched.

---

## 1. The core diagnosis

The current structure (`wireframes.md`, carried into `kaizi_v2_enhanced.html`) is a **living
world plus four flat, equal-weight tabs**: Home/World, Promises, Journey, You, with
Reflection reachable only as a link off Promises/Journey. That's the problem in one
sentence: *the single best thing this app has — the world — is structurally demoted to
"one tab among five."* A tab bar tells the user, by construction, that all five
destinations matter equally. They don't. Nobody opens Kaizi to visit "Journey." They open
it to check on Haru, or because a promise is due, or to close out the day. The nav
should say that, not fight it.

Durable "check in on someone" apps (Animal Crossing, Tamagotchi, the better idle-life-sim
genre) share a pattern worth borrowing without copying: **one persistent world you drop
into, with everything else as a layer on top of it or a deliberate, occasional side trip**
— never a peer destination. Kaizi's own mockup already proves this pattern works: Chat is
already an overlay sheet on the world, not a separate screen, and it's the best-feeling
part of the existing build. Proposal: apply that same pattern to the rest of the app
instead of leaving it as the one exception.

## 2. The actual daily-use pattern (what structure should be organized around)

- **~7am** — fast, low-friction. "What's today?" Wants: see today's intentions, maybe get
  a nudge, get out. Does *not* want a dashboard.
- **Random 2pm break** — the "check in on someone" moment. Wants: see what Haru's doing,
  maybe a quick line back and forth, no task in mind at all. This is the moment the whole
  product is built to win, and it's the one the current flat-tab structure serves worst
  (it puts "World" behind a tab tap instead of *being* the app).
- **~9pm** — reflective, closing the loop. Wants: acknowledge the day, journal, hear from
  Haru about how it went. A once-a-day ritual, not a thing that needs permanent nav real
  estate.
- **Rare/deliberate** — "let me see how far I've come" or "let me change how Haru looks/
  talks/where he lives." Looking-back and configuration. Infrequent, but needs to be a
  real screen because it's dense (graphs, grids) — it just doesn't need to compete with
  the world for primary billing.

## 3. New structure: two destinations, not five

```
World (the only "home")                          You (deliberate, occasional)
├── Ambient overlays (always visible)             ├── Progress   (was: Journey)
│   ├── Greeting + zone travel strip               ├── Companion  (was: Identity's
│   ├── Intentions pouch (compact, quick-keep)     │    customization rows — species/
│   ├── Chat FAB → Chat sheet                       │    personality/environment, all
│   └── "You" avatar chip → You screen              │    editable any time)
└── Contextual sheets (slide over the world,        └── Settings   (was: Identity's
     dismiss returns to World)                          subscription/notifications/
     ├── Chat sheet (already built, unchanged)          export/reset rows)
     ├── Intentions sheet (was: Promises tab)
     └── Reflection sheet (was: Reflection screen,
          now evening-contextual, not a nav item)
```

**What actually changed, screen by screen:**

| Was (v2, flat) | Becomes (v3) | Why |
|---|---|---|
| Home/World (1 of 5 tabs) | **World** — the app's only home, always-on, no tab bar | Protects the emotional core instead of demoting it to a fifth of the nav. This is the single biggest structural change. |
| Promises (full tab) | **Intentions sheet**, opened from a compact pouch widget that lives *on* the world | Keeping a promise should feel like it affects the place you're standing in, not a separate checklist screen. The pouch still supports one-tap "keep" for the very next item without opening the sheet — the 7am fast path stays fast. |
| Journey (full tab) | **You → Progress** tab (segmented, not global nav) | Looking back at stats is a real feature but a low-frequency one (once every few days at most). Doesn't need permanent nav weight. |
| You/Identity (full tab) | **You → Companion** + **You → Settings** tabs | Same reasoning — customization and settings are deliberate visits, not daily habits. Merged into one destination instead of two so there's exactly one "everything else" screen. |
| Reflection (link off other tabs, no nav slot) | **Reflection sheet**, contextually surfaced (evening time-of-day, or once today's intentions are done) instead of hunted for | It's used ~once/day, at a specific time. A generic tab is both over- and under-serving it — present all day when it's only relevant at night, and just another item to scan past the other 11 hours. |

Nav chrome that disappears entirely: the 4-item bottom tab bar (`.nav-pill` in v2). There
is no persistent tab bar in v3. The world *is* the app; "You" is reached via a small
avatar chip, not a nav item with equal visual weight to "Home."

### Retention reasoning, condensed
- Fewer, better-weighted destinations reduce the "which of these five things should I do"
  hesitation on open — the app opens directly into the thing people actually came for.
- Surfacing Intentions and Reflection as layers *on* the world (not away from it) means
  every action a user takes reads as something happening *to Haru's world*, reinforcing
  the companion/identity thesis instead of competing with it via a generic CRUD-app tab
  bar.
- The 7am and 2pm use moments both get faster: 7am's one-tap "keep" survives without a
  full sheet; 2pm's "check on Haru" is now literally what opens when the app opens, zero
  taps required.
- The 9pm ritual gets a dedicated, well-crafted moment (the Reflection sheet) without
  cluttering the day-long nav with something only relevant for ten minutes of it.
- The home-screen widget (`v2-retention-proposals.md` #4) becomes an even more natural
  extension of this structure once built: the OS widget and the in-app "home" now show
  literally the same thing (the world), rather than a widget standing in for one tab among
  several.

## 4. Garden depth — structural, not cosmetic

The founder's ask was explicit: more than better animation (already done in
`kaizi_v2_enhanced.html` — parallax, lighting, layered companion motion, rare micro-idles).
"Depth" here means the world gets *bigger and more personal* as the relationship matures,
not just prettier at a fixed size.

### 4.1 Multi-zone world, personalized to the user's actual goals
The world is no longer one fixed diorama. It's a small set of **zones** — different
corners of the same continuous garden (shared sky, shared time-of-day, shared distant
hills — so it never reads as "teleporting between separate app screens," just walking
further into the same place):

| Zone | Always/gated | Maps to onboarding goal(s) |
|---|---|---|
| **The Courtyard** | Always unlocked, day 1 | The existing zen garden (koi pond, sand garden, azaleas, meditation stone, stone lanterns) — unchanged, still the default/anchor zone. |
| **The Training Ground** | Gated | Fitness, Discipline |
| **The Study Veranda** | Gated | Business, Learning |
| **The Spring** | Gated | Skin |

A user only ever sees zones relevant to goals they actually picked in onboarding (plus the
always-on Courtyard) — the world is *built around their specific transformation*, not a
generic map everyone gets. Locked zones show as a soft, non-guilt teaser (a dim
silhouette + "Unlocks after a 7-day streak in {goal}") in the zone travel strip — visible,
aspirational, never shamed; consistent with proposal #1's no-decay/no-guilt rule.

The mockup builds two zones in full (Courtyard, reused verbatim; Training Ground, new) and
one locked teaser, which is enough to demonstrate and evaluate the mechanic without
building all four for a pre-approval mockup.

**Why this is the real "depth" lever:** a bigger, personally-relevant, earned space is a
stronger pull than a static screen with better particle effects. It gives literal, spatial
meaning to "the garden grows with you" (already Journey's flavor copy) instead of that
being a progress bar's tagline.

### 4.2 Companion's zone reflects real user data, not a random walk
Today (v2) Haru's activity rotates through a fixed loop, blind to anything the user
actually did. In v3, which zone/activity Haru is in is a **deterministic function of
today's intentions**: Haru tends toward the zone matching whichever goal has the next
unkept intention today, falling back to the Courtyard when everything's kept or it's
outside "garden hours." This makes the world feel like it's reacting to the user's real
day, not decorative. (See §5 — this needs a small backend rule, not new schema.)

### 4.3 Weather, layered on top of the existing day/night cycle
`kaizi_v2_enhanced.html` already has time-of-day (dawn/day/dusk/night) and one *permanent*
seasonal shift (day-90 maple, spring→autumn, tied to streak). v3 adds a second, **ephemeral**
weather layer independent of streak state — clear / light rain / mist — that varies
day to day (client-derivable from date, no backend needed) purely for atmospheric variety,
layered under the permanent streak-driven state. Rain and mist read differently in each
zone (rain on the Courtyard's pond vs. on the Training Ground's gravel) since it's a
world-level effect, not a per-zone asset.

### 4.4 A defined day-180 milestone (closing the "TBD" in world-spec.md #6)
`world-spec.md` left day 180 as "TBD — space for a full bloom garden state." v3 defines it
concretely: **The Lantern Festival** — every unlocked zone permanently gains string-light
accents (not just the Courtyard's two gated lanterns). Cumulative and permanent, same rule
as every other milestone in the table — this is a proposal to fill in the spec's known gap,
not a new mechanic type.

### 4.5 More places that reward close attention
`kaizi_v2_enhanced.html`'s rare micro-idle poses (stretch, glance-at-sky) are the existing
instance of this pattern. v3 adds a second instance in the same spirit: tapping specific
scenery (the koi pond, a lantern) triggers a small one-off reaction — a ripple burst, a
sparkle — independent of the companion tap/speech system. Small, optional, discoverable;
rewards people who poke at the world instead of just watching it.

## 5. New backend requirements this restructure creates

Two gaps were already flagged in `kaizi/docs/ep-notes.md` before this restructure (no
server-side "current activity," no persisted world-state/streak-milestone table). This
restructure needs both, and extends their scope. Listed explicitly per instructions —
none of this is built, and this phase does not build it:

1. **Per-goal streak/milestone tracking (extends ep-notes Gap 2).** Zone unlocking needs a
   streak computed *per goal category*, not just the existing global streak — e.g., a
   7-day streak specifically on Fitness/Discipline-tagged intentions unlocks the Training
   Ground. Needs a small ratchet table (e.g., `zone_state(user_id, zone_id,
   highest_streak_reached)`), ratcheted per proposal #1/#6's no-decay rule, likely
   extending whatever table resolves ep-notes Gap 2 rather than a second table.
2. **"Current zone/activity" derivation (extends ep-notes Gap 1).** Needs a rule, not just
   an escape hatch: current zone = zone of the next unkept intention today (by goal
   tag), falling back to Courtyard. Can be a deterministic server-side function over the
   existing `intentions` table (no new table required) but must be written down and shared
   so the app, the world-state widget, and the SMS templates (`world-spec.md` #5) agree —
   today nothing computes this at all.
3. **Day-180 milestone added to the milestone set.** Whatever table/ratchet resolves #1
   above needs `180` added to its known milestone list — a one-line addition once that
   table exists, called out here so it isn't dropped when #1/#2 above get built.
4. **Explicitly NOT new backend work:** the goal→zone mapping itself (Fitness/Discipline→
   Training Ground, etc.) is static business logic, not new schema — `goals[]` is already
   collected and stored by onboarding. Weather is entirely client-derived (no persistence
   needed). Calling this out so the backend ask doesn't get inflated beyond what's actually
   new.

## 6. What did not change (by design)

- **Art direction** — palette, Cormorant Garamond/Inter pairing, the ink/gold/sand system,
  Haru's visual style, the glass/mist surface language: untouched. The founder loves it;
  this is an IA and depth change, not a re-skin.
- **Onboarding** — zero changes to `onboarding-spec.md` or its 7-screen flow. It's shipped,
  tested, and out of scope per the brief. The only thing v3 *reads* from onboarding is the
  already-collected `goals[]` array, to decide which zones exist for a given user.
- **Backend naming/vocabulary** — "Intention" (not "Promise") is used throughout this doc
  and the mockup, matching the rename already live in `world-build-plan.md` and the actual
  API (`/api/intentions`). The v2 mockup still says "Promises" in a few places; v3 is
  consistent with the shipped backend.
- **Chat** — unchanged in behavior (real Claude API companion chat, per
  `world-build-plan.md`); only its context shifts slightly, from "one overlay among many
  interaction styles" to "the reference pattern every other interaction now follows."
