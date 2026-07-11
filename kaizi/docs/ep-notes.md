# EP Notes — Scope Gaps Observed in Planning Docs

Per my mandate, these are gaps I noticed in the *plan* itself (`world-build-plan.md`
vs. `world-spec.md`), not bugs in built code. I am not building any of this — flagging
for the lead/founder to fold into the plan (or explicitly defer) before it's built.

## Gap 1: No backend surface for "current companion activity" (world-spec.md #5)

`world-spec.md` §5 ("SMS mirrors the living world") explicitly states:

> Backend needs to track/derive the companion's "current activity" server-side (or
> accept it's approximate/simulated) so the SMS and the app don't contradict each other.

`world-build-plan.md`'s "New backend surface (queued, not yet built)" section lists
`chat/message`, `intentions`, `companion_customization`, and `journal_entries` — there is
no table, column, or endpoint anywhere in the plan (or in the migration backend2 actually
wrote, `002_companion_world.sql`) that stores or derives a "current activity." Without it,
the Twilio SMS templates (`sms-templates.ts`) have no server-side source of truth to pull
a real activity from, so proposal #5 can't be implemented as specced — it would have to
fall back to the "approximate/simulated" escape hatch the spec itself allows, which the
plan doesn't call out as the chosen path either.

**Suggest:** the lead either (a) adds an explicit "current activity" derivation rule to
the plan (e.g. deterministic function of time-of-day + environment, no new table needed —
matches the spec's "or accept it's approximate/simulated" fallback), or (b) adds a small
`companion_activity_state` concept to the schema if activity needs to be more than a pure
function of time. Either is a small addition; I'm not picking one unprompted.

## Gap 2: No persisted world-state / streak-milestone table (world-spec.md #6)

`world-spec.md` §6 ("Streak-driven world states") calls for **concrete, persisted visual
milestones** (first lantern at day 7, second at day 14, azaleas at day 30, third koi at
day 60, red maple at day 90) that are explicitly "cumulative and permanent (never reverse
on a missed day)."

Nothing in `world-build-plan.md`'s backend surface, and nothing in the actual
`002_companion_world.sql` migration, persists this. The `intentions` table has enough raw
data (`status`, `kept_at`, `scheduled_for`) to *compute* a streak on the fly, but the spec
requires the milestones to be **permanent once reached** — if a user has a long unbroken
streak, breaks it, then keeps intentions again, a purely-computed-from-`intentions` streak
would make the lantern/azalea/koi/maple state regress, which directly contradicts "never
reverse on a missed day." That needs either a ratchet (store the highest milestone ever
reached, not just the current streak) or a dedicated small state table.

**Suggest:** the lead add a one-row-per-user `world_state` (or similar) concept — even
just a `highest_streak_milestone_reached integer` column — to the plan before this is
built, so whoever implements the Home screen and Journey screen doesn't have to make that
call mid-implementation.

## Gap 3: Companion-initiated speech context selection (world-spec.md #2) is implicitly covered, no new gap

Proposal #2's priority-ordered context sources — (a) an unkept promise from today, (b) a
streak milestone reached today, (c) time-of-day flavor, (d) fallback quote pool — are all
derivable once Gap 1/2 above are resolved (unkept promise: query `intentions` for today;
streak milestone: needs Gap 2's persisted state to know if *today* is the day a milestone
was newly reached, not just currently active). Not a separate gap, just noting it depends
on Gap 2 being resolved first.

---

None of the above blocks the currently-planned build (chat, intentions, customization,
journal) — they're gaps in the *later* proposals (#5, #6) that the plan says are "queued"
but whose backend surface isn't fully specified yet. No code changes made for this note.
