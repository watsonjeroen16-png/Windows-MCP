# Kaizi Onboarding — Screen Spec (Frames 1–7)

Scope: wireframes.md Section B only. Visual language: `tokens.md` (transcribe to `app/src/ui/tokens.ts`).
Canvas reference: 375 × 812 (design at this size, lay out with flex so it scales).
Global ground: `ground.base` (#0E0D0B) unless a screen states otherwise.

## Global navigation chrome (screens 2–7)

- **ProgressDots** — centered under the status bar: 7 dots, 5px, gap 8. Current: `gold.icon90`, 5×14 pill; completed: `gold.ink50`; upcoming: `line.14`. Animate width/color 250ms ease-out on step change.
- **Back affordance** — from screen 2 onward: 36×36 tap target at top-left (chevron-left, 20px stroke 1.5, `text.faint`). Tapping goes to previous screen with state preserved. Screen 1 has no back. Android hardware back mirrors it (exits app from screen 1 only after confirm).
- **Screen transition** — content enters with `card-slide-in` (380ms ease-out); on back, mirrored from the left. Background (ZenBackground) persists and does NOT re-animate between steps — only foreground content transitions.
- **Continue placement** — every primary CTA is a full-width pill pinned above the home indicator, horizontal inset `space.xxxl` (32), bottom clearance `space.footer` region (padding-bottom 48–60).
- Progress is saved to onboarding state after each step; killing the app resumes at the last incomplete step.

---

## Screen 1 — Welcome

**Purpose:** set the emotional register. No data collected.

**Layout (top → bottom)**
1. Full-bleed **ZenBackground** (variant `welcome`): `ground.deep` base; hill ellipses `#1A1510`/`#221C14`; 5 bamboo stalks left+right (`#2A2218`, `bamboo-sway` 4s, staggered 0.3–1.1s); garden bed ellipses `#141008`/`#0E0C08`; foreground hill path `ground.deep`; pond with two `water-ripple` ellipses (3s, 0.5s offset); gold glow orb upper-right — 3 concentric circles `gold.glow4/5/6` with a slow `lantern-glow` pulse; 4 blossom particles (`blossom-fall`, 8–13s, delays 0/1/2/4s).
2. Centered stack (flex 1, padding 60 40 20):
   - Wordmark: **KAIZI** — `type.wordmark` (serif 48, weight 300, letter-spacing 0.12em, `cream`).
   - Gold hairline divider: 40 × 0.5px, `gold.ink50`, margins 14 top / 18 bottom.
   - Tagline: **"Improve a little.\nWin a lot."** — `type.tagline` (serif italic 16, `sand`, letter-spacing 0.06em, line-height 1.5, centered, quoted).
   - Title (below tagline, margin-top 28): **"Build a life that builds you back"** — serif 22, weight 300, `cream`, centered, line-height 1.3.
   - **CompanionAvatar** (neutral silhouette, ~90×110) seated on the garden bed between title and CTA, `idle-sway` 4s, ground shadow `shadow.figure`. Use the human-figure composition from the mockup until a companion is chosen.
3. Footer block (padding 0 32 60):
   - CTA pill: **"BEGIN"** — hero neutral variant (`mist.10` fill, 0.5px `line.22` border, radius 999, padding-v 18, `type.buttonLg` cream).
   - Microcopy (margin-top 16, centered): **"Every promise shapes who you're becoming"** — `type.subSerif` italic 13, `text.faint`.

**States:** none disabled; CTA always active. Press: scale 0.98, fill → `mist.16` (120ms).
**Navigation:** Begin → Screen 2. No progress dots, no back.
**Reduce Motion:** freeze all ambient loops at their midpoint; keep CTA press feedback.

---

## Screen 2 — Goal Selection

**Purpose:** collect `goals[]` (multi-select, min 1).

**Layout**
1. Status bar / back chevron / ProgressDots (step 2 of 7).
2. Header (padding 8 28 0):
   - Eyebrow: **"FIRST PROMISE"** — `type.micro`, `text.micro`.
   - Title: **"What are you building?"** — `type.title` serif 28, `cream`.
   - Subtitle: **"Choose everything that matters to you."** — `type.subSerif` italic 14, `sand`, margin-top 6.
3. Chip field (flex 1, centered, padding 24 28): wrapping row of **Chip** components, gap 12:
   - `Fitness` · `Skin` · `Business` · `Discipline` · `Learning`
   - Chip: pill, padding 12 v / 20 h, `type.buttonSm`. States per tokens.md §6 chip table. On select: `xp-pop` (350ms) + border/fill transition 250ms. Multi-select; tap again to deselect.
4. Selection hint under chips (centered, min-height reserved): when ≥1 selected show **"{n} selected"** — `type.meta`, `gold.ink60`; else empty.
5. Footer CTA: **"CONTINUE"** — goldButton quiet variant.
   - **Disabled** (0 selected): fill transparent, border `line.8`, text `text.trace`, non-pressable, no press feedback.
   - Enabled: `gold.fill10` / `gold.line22` / `gold.solid` text; transitions 250ms when first chip is selected.
6. Footer microcopy: **"You can add more goals later"** — `type.subSerif` italic 12, `text.faint`, margin-top 12, centered.

**Background:** `ground.base` with a dim ZenBackground variant `ambient` (single hill ellipse at 40% opacity, 2 blossoms) — quieter than Welcome.
**Empty/error states:** disabled CTA is the empty state; no error toast needed.
**Navigation:** Continue → Screen 3. Back → Screen 1 (selections preserved).

---

## Screen 3 — Identity Input

**Purpose:** collect `identityWhy` — the sentence that seeds the companion's long-term memory.

**Layout**
1. Chrome (back, dots step 3).
2. Header (padding 8 28):
   - Eyebrow: **"YOUR WHY"** — `type.micro`, `text.micro`.
   - Prompt: **"Why are you doing this?"** — `type.title` serif 28, `cream`.
   - Framing line: **"Say it honestly. Your companion will remember."** — `type.voice` serif italic 15, `sand`, margin-top 8.
3. Full-screen input (flex 1, padding 20 28):
   - Multiline **textarea**: fill `mist.4`, border 0.5px `line.10`, radius 16, padding 16, `type.bodySans` 15, `cream`, line-height 1.6, min-height 160, grows with content.
   - Placeholder: **"Because I'm tired of almost. Because my kids are watching. Because I promised myself…"** — `text.faint`.
   - Character counter bottom-right inside padding: `type.meta` `text.ghost`, appears after first keystroke, format `{n}/280`. Hard cap 280.
4. Footer CTA: **"SAVE TO MEMORY"** — goldButton quiet.
5. Footer microcopy: **"This becomes the first thing your companion knows about you"** — serif italic 12, `text.faint`.

**Validation & states**
- Min length **10 characters** (trimmed). Below min: CTA disabled (same disabled recipe as screen 2).
- Empty state: placeholder visible, CTA disabled, counter hidden.
- On save: brief `xp-pop` on the CTA label swapping to **"REMEMBERED"** in `gold.solid` for 600ms, then navigate.
**Keyboard handling:** screen wraps in KeyboardAvoidingView; CTA stays pinned above keyboard (docked to keyboard top when open); textarea auto-focuses 400ms after transition; return key = newline; tap outside dismisses keyboard; content scrolls if keyboard overlaps.
**Navigation:** Save → Screen 4. Back → Screen 2 (draft text preserved).
**Background:** `ground.night` (#080907) — the quietest, most private screen; 2 slow blossoms only.

---

## Screen 4 — Companion Selection

**Purpose:** collect `companion` (single select from 7).

**Layout**
1. Chrome (back, dots step 4).
2. Header: eyebrow **"YOUR COMPANION"**; title **"Who walks with you?"** (`type.title`); subtitle **"They'll grow as you do."** (italic 14, `sand`).
3. Scrollable 2-column grid (padding 20 24, gap 12) of **CompanionAvatar cards**:
   - Card: glassCard recipe (fill `mist.7`, border `line.14`, radius 24), aspect ~3:4, padding 14.
   - Contents: SVG composition (below) centered, `idle-sway` loop; name beneath — serif 16, `cream`; one-word trait under it — `type.micro`, `text.micro`.
   - Selected: border → `gold.line40`, fill → adds `gold.fill10` overlay, name → `gold.solid`, `xp-pop` once. Single-select; selecting another deselects.
4. Footer CTA: **"CONTINUE"** — goldButton; disabled until a companion is chosen.

**The 7 companions — SVG compositions (all built from primitive shapes + tokens palette; NO paid/licensed assets) and idle motion:**

| Companion | Trait label | Composition (shapes) | Idle motion |
|---|---|---|---|
| **Wolf Pup** | LOYAL | Grey-blue rounded body (`#3A4048`), oversized head circle, two triangle ears (inner triangles `#C8B89A`), pale muzzle ellipse (`#C8CCD2`), bushy tail arc, eyes `eye.ink` + white catchlights | `idle-sway` + tail-arc rotate ±6° (2.5s); one ear twitch every 6s |
| **Fox** | CLEVER | Rust-orange body (`#B8622E`), sharp triangle ears, white chest + tail-tip ellipses (`cream` at 0.9), narrow eye ellipses, whisker strokes | `idle-sway`; tail sweep translateX ±3px (3s); eyes blink (scaleY 1→0.1→1) every 4s |
| **Lion** | BOLD | Golden body (`#C99C46`), layered mane of 8 overlapping petal ellipses (`#8A5A20`→`#D4A853` gradient ring), round muzzle, small round ears inside mane | slow mane petals rotate ±1.5° alternating (bamboo-sway timing); chest rise translateY -1.5px (4s) |
| **Dog** | STEADY | Warm brown body (`#8A6844`), floppy ear rounded-rects hanging beside head, tongue pink ellipse (`rgba(230,150,150,0.8)`), collar band `gold.ink60` | tail wag rotate ±10° (1.2s — the fastest idle in the set); head tilt 2° every 7s |
| **Human Male** | GROUNDED | Mockup figure verbatim: moss robe rects (`robe.moss`/`#1E2A1A`), skin `skin.warm`, hair cap + side rects `hair.dark`, seated meditation pose, ground shadow | `idle-sway` (breathing); shoulders scaleY 1→1.015 (4s, synced) |
| **Human Female** | GRACEFUL | Same seated pose; longer hair (hair ellipse extended to shoulder rects `hair.dark`), robe in deep plum (`#3A2A35`), small blossom dot in hair (`blossom` pink) | `idle-sway`; hair-end rects sway ±1.5° (5s); occasional slow blink |
| **Dragonkin** | FIERCE | Teal-scaled body (`#2A5A55`), two curved horn paths (`sand`), small wing triangles behind shoulders (`rgba(42,90,85,0.6)`), gold eye slits (`gold.solid`), tiny ember particles | `idle-sway`; wings scaleY 1→1.06 (3.5s); 2 ember dots `particle-rise` (4s) |

All compositions sit on a `shadow.figure` ground ellipse. Preview canvas ~120×140 inside the card.
**Performance note:** run at most the visible cards' loops; pause off-screen animations.
**Navigation:** Continue → Screen 5. Back → Screen 3.
**Background:** `ground.base` + ambient variant.

---

## Screen 5 — Personality Selection

**Purpose:** collect `personality` (single select from 5). Cards preview the companion's voice.

**Layout**
1. Chrome (back, dots step 5).
2. Header: eyebrow **"THEIR VOICE"**; title **"How should they speak to you?"**; subtitle **"Hear each one. Choose the voice you'll listen to."** (italic 14, `sand`).
3. Vertical stack (scrollable, padding 16 24, gap 10) of 5 **PersonalityCards**:
   - Card: glassSubtle (fill `mist.5`, border `line.8`, radius 18, padding 16 18).
   - Row 1: personality name — serif 17, `cream`; right-aligned one-word tag — `type.micro`, `text.micro`.
   - Row 2 (margin-top 10): **sample dialogue** in companion-voice styling — `type.voice` serif italic 15, `cream`, line-height 1.5, quoted — inside a companion chat bubble (fill `mist.7`, border `line.10`, radius 4/16/16/16, padding 12 16). Micro-label above bubble: **"THEY MIGHT SAY"** — `type.micro`, `text.ghost`.
   - Selected: card border `gold.line40`, name `gold.solid`, `xp-pop`.

**Exact sample dialogue lines (canonical — engineers and backend use these verbatim):**

| Personality | Tag | Sample line |
|---|---|---|
| **Coach** | DRIVEN | "We've got a plan and today is step one — let's get to work." |
| **Tough Love** | UNFILTERED | "Nobody is coming to save you. Show me what you've got." |
| **Mentor** | WISE | "Every master was once a beginner who refused to quit." |
| **Supportive** | WARM | "I'm proud of you for showing up today. We'll take it one step at a time, together." |
| **Rival** | COMPETITIVE | "I've already finished my training today. Your move." |

4. Footer CTA: **"CONTINUE"** — goldButton; disabled until selected.
**Navigation:** Continue → Screen 6. Back → Screen 4.
**Background:** `ground.panel` (#0B0A08), no scenery — the cards are the scene.

---

## Screen 6 — Environment Selection

**Purpose:** collect `environment` (single select from 12).

**Layout**
1. Chrome (back, dots step 6).
2. Header: eyebrow **"YOUR WORLD"**; title **"Choose your world"**; subtitle **"Where your companion lives — and where you'll meet."** (italic 14, `sand`).
3. Scrollable **3-column × 4-row grid** (padding 16 20, gap 10) of **EnvironmentTiles**:
   - Tile: radius 16, border 0.5px `line.10`, aspect 1:1.25, overflow hidden. Fill = 3-stop vertical gradient (below) + one animated accent layer. Name label pinned bottom: `type.micro` 9px uppercase, `cream` at 0.85, over a bottom scrim `rgba(0,0,0,0.35)` fading up.
   - Selected: border `gold.line40` + inner 0.5px ring `gold.line20`; label → `gold.solid`; `xp-pop`.

**12 tiles — gradient recipes (top→bottom) + one subtle motion each:**

| Tile | Gradient | Motion |
|---|---|---|
| **Cyber City** | `#0A0E1A → #16204A → #2A1A4A` | 2 neon dots (`rgba(90,200,255,0.5)`, `rgba(255,90,180,0.4)`) `lantern-glow` staggered |
| **Modern Apartment** | `#141210 → #241E16 → #3A2E1E` | Warm window rect (`gold.glow8`) slow `lantern-glow` |
| **Forest Village** | `#0A140C → #14261А`* → `#1E3820` (*use `#14261A`) | 1 blossom-style leaf particle drifting (`blossom-fall`, green `rgba(140,190,120,0.4)`) |
| **Mountain Retreat** | `#0C1016 → #1A2430 → #2E3A46` | Fog band `fog-drift` across the midline |
| **Dojo** | `#160F0A → #2A1A10 → #3A2416` | Lantern dot `gold.line25` `lantern-glow` |
| **Coastal Paradise** | `#081420 → #0E2A3A → #1A4A50` | Water ellipse `water-ripple` at bottom third |
| **Fantasy Kingdom** | `#100A1E → #241440 → #3A2060` | 2 gold motes `particle-rise` |
| **Space Colony** | `#05060C → #0C1024 → #1A1A3A` | 3 star dots (1px, cream 0.6) `lantern-glow` at long staggers |
| **Japanese Garden** | `#090C0A → #0F1A12 → #14261A` | Blossom petal `blossom-fall` (this is the mockup's Zen Garden — default highlight) |
| **Training Campus** | `#0C0E10 → #1C2226 → #2E3A34` | Horizontal track line pulse (opacity 0.2→0.4, 3s) |
| **Entrepreneur District** | `#0E0C08 → #201A10 → #36281A` | Skyline window dots (2, `gold.glow8`) alternating `lantern-glow` |
| **Sky Islands** | `#0A0F1C → #16283E → #2A4A5E` | Island silhouette `idle-sway` (translateY ±2px, 6s) |

Japanese Garden tile carries a small **"BEGIN HERE"** micro-label (`type.micro`, `gold.ink60`) — it is the recommended default and pre-scrolled into view, but nothing is pre-selected.
**Performance:** only animate visible tiles; one accent layer per tile, max ~8 concurrent loops.
4. Footer CTA: **"CONTINUE"** — goldButton; disabled until selected.
**Navigation:** Continue → Screen 7. Back → Screen 5.
**Background:** `ground.base`, no scenery (tiles carry the color).

---

## Screen 7 — SMS Setup (3 sub-screens)

**Purpose:** collect `phone` (E.164 — the ONLY contact detail collected), `smsPrefs`, verify, hand off.

### 7a — Phone + preferences

**Layout**
1. Chrome (back, dots step 7).
2. Header: eyebrow **"STAY CONNECTED"**; title **"One last promise"**; subtitle **"Your companion checks in by text. No email, no spam — just them."** (italic 14, `sand`).
3. **PhoneInput** (padding 24 28):
   - Single row, pill-shaped field (radius 999, fill `mist.5`, border `line.12`, padding 14 20): country-code selector on the left (flag emoji + `+1`, `type.bodySans` `cream`, chevron-down 12px `text.faint`; opens a bottom sheet list — glassHeavy, search field, country rows) · 0.5px vertical divider `line.10` · number field (`type.bodySans` 16, `cream`, keyboard type phone-pad, national formatting as-you-type).
   - Placeholder: **"(555) 123-4567"** — `text.faint`.
   - Stored/submitted as E.164 (`+15551234567`). Validate with libphonenumber; never trust visual format.
   - Micro-label above field: **"MOBILE NUMBER"** — `type.micro`, `text.micro`.
4. Toggle group (margin-top 20) — glassSubtle card (radius 18) with two rows separated by 0.5px `line.5`:
   - Row: label serif 15 `cream` + sub-label `type.meta` `text.faint` + **Toggle** on right.
     - **"Morning plan"** / "A text to start your day with intention" — default ON
     - **"Evening check-in"** / "A moment to close the day honestly" — default ON
   - Toggle: 44×26 track radius 999; off: fill `mist.10`, border `line.14`, knob `text.faint`; on: fill `gold.fill20`, border `gold.line40`, knob `gold.solid`. Slide 250ms ease-out.
5. Footer CTA: **"SEND CODE"** — goldButton; disabled until number is valid for selected country.
6. Footer microcopy: **"Your number is used only for your companion's messages. Never shared."** — `type.subSerif` italic 12, `text.faint`.

**Error states:** invalid number on submit → field border `rgba(200,80,60,0.5)`, message below (`type.meta`, `rgba(230,140,120,0.8)`): **"That number doesn't look right. Check the country code?"**. Network/send failure: same style, **"We couldn't send the code. Try again in a moment."** with CTA re-enabled.

### 7b — Verification code

**Layout** (slides in with `card-slide-in`; back returns to 7a with number preserved)
1. Chrome (back, dots stay at step 7).
2. Header: eyebrow **"VERIFY"**; title **"Enter the code"**; subtitle: **"Sent to {formatted phone}"** — `type.meta`, `text.muted`.
3. **CodeInput** — 6 boxes centered (gap 10): 44×54, radius 14, fill `mist.5`, border 0.5px `line.12`; digit serif 24 `cream`. Focused box: border `line.22`. Filled box: `xp-pop` on digit entry. One-time-code autofill supported (iOS `textContentType=oneTimeCode`, Android SMS Retriever). Auto-submit on 6th digit.
4. Resend row (margin-top 20, centered): **"Didn't get it? Resend code"** — `type.meta`; "Resend code" segment in `gold.ink60`, tappable after a 30s countdown shown as **"Resend in {s}s"** (`text.faint`) beforehand.
5. No CTA button — auto-submit; a subtle inline spinner (3 gold dots, `lantern-glow` staggered) replaces the resend row while verifying.

**Error state:** wrong code → all boxes shake (translateX ±6px, 3 cycles, 300ms), borders flash `rgba(200,80,60,0.5)`, message below: **"That code didn't match. Try again."**; boxes clear, focus returns to first. After 5 failures: force resend (**"Too many tries. We sent you a fresh code."**).

### 7c — Handoff confirmation (terminal screen)

This is the **last screen in the app** for this build — there is no post-onboarding destination. The relationship continues over SMS. (Mission Hub and the other frames are future scope only.)

**Layout** (final screen, no back, dots complete: all 7 in `gold.ink50`)
1. ZenBackground returns (variant matching the chosen environment's gradient as sky tint if feasible; else `welcome` variant).
2. Centered stack:
   - Selected **CompanionAvatar** (larger, ~140×170), `idle-sway`, gold glow orb behind (`gold.glow4/5/6` rings, `lantern-glow`).
   - Title: **"{Companion name} is on their way"** — serif 26, weight 300, `cream`. (Species used as name until naming feature ships: "Your Fox is on their way".)
   - Companion-voice line: **"I'll text you shortly. When I do — answer honestly."** — `type.voice` serif italic 16, `cream`, in a companion bubble.
   - Confirmation rows (glassSubtle card): checkmark 14px `gold.icon90` + `type.meta` `text.muted`: "Number verified" · "Morning plan {on/off}" · "Evening check-in {on/off}".
3. Footer status line (replaces a CTA — nothing left to tap): **"Keep your phone close"** — `type.buttonSm` styling but non-interactive, `text.muted`, centered; beneath it three gold dots pulsing `lantern-glow` (staggered 0/0.4/0.8s) as a quiet "listening" indicator.
4. Footer microcopy: **"Every promise shapes who you're becoming"** — serif italic 13, `text.faint` (bookends the flow with the Welcome line).

**On reaching 7c:** onboarding state is committed immediately (no further user action required) and the first SMS is enqueued server-side (template below). The app rests on this screen; ambient loops continue. Re-opening the app returns here.

---

## Component Inventory (build under `app/src/ui/`)

| Component | Props (sketch) | Notes |
|---|---|---|
| `GlassCard` | `variant: 'subtle'\|'standard'\|'heavy'`, `radius?` | tokens.md §6 recipes |
| `Chip` | `label, selected, disabled, onPress` | pill; xp-pop on select |
| `SerifTitle` | `size: 'wordmark'\|'title'\|'heading'`, `italic?` | Cormorant wrapper |
| `MicroLabel` | `children, tone: 'default'\|'gold'\|'ghost'` | uppercase Inter 9–11 |
| `CompanionVoice` | `children` | serif italic quoted bubble text |
| `GoldButton` | `label, variant: 'quiet'\|'emphatic'\|'heroNeutral'\|'secondary', disabled, onPress` | pill CTA |
| `ProgressDots` | `total=7, current` | animated width/color |
| `BackChevron` | `onPress` | 36×36 target |
| `PhoneInput` | `value, country, onChange` → E.164 | country sheet included |
| `CodeInput` | `length=6, onComplete, error` | autofill, shake, auto-submit |
| `Toggle` | `value, onChange, label, subLabel` | gold-on state |
| `ZenBackground` | `variant: 'welcome'\|'ambient'\|'night'` | SVG scene + particle layers; respects Reduce Motion |
| `BlossomLayer` | `count, palette` | shared particle system |
| `CompanionAvatar` | `species: CompanionId, size, animated` | 7 SVG variants + idle loops |
| `EnvironmentTile` | `id: EnvironmentId, selected, onPress` | 12 gradient+motion variants |
| `PersonalityCard` | `id, selected, onPress` | includes canonical sample line |
| `ChatBubble` | `role: 'companion'\|'user'` | 4/16/16/16 vs 16/4/16/16 |
| `OnboardingScreen` | `step, onBack, children, cta` | shared chrome: dots, back, CTA slot, keyboard avoidance |

## Navigation Flow

```
Welcome(1) ──Begin──▶ Goals(2) ──Continue──▶ Why(3) ──Save──▶ Companion(4)
   ▲                    │ back◀──────────────│ back◀───────────│ back
   └────────back────────┘
Companion(4) ──▶ Personality(5) ──▶ Environment(6) ──▶ SMS/phone(7a)
                 │ back◀────────────│ back◀────────────│ back
SMS(7a) ──Send code──▶ Verify(7b) ──6 digits ok──▶ Handoff(7c)  [terminal — app rests here]
             ▲ back (edit number)──┘                  (no back)
```

## Onboarding State Shape

```ts
type CompanionId = 'wolfPup' | 'fox' | 'lion' | 'dog' | 'humanMale' | 'humanFemale' | 'dragonkin';
type PersonalityId = 'coach' | 'toughLove' | 'mentor' | 'supportive' | 'rival';
type EnvironmentId =
  | 'cyberCity' | 'modernApartment' | 'forestVillage' | 'mountainRetreat'
  | 'dojo' | 'coastalParadise' | 'fantasyKingdom' | 'spaceColony'
  | 'japaneseGarden' | 'trainingCampus' | 'entrepreneurDistrict' | 'skyIslands';

interface OnboardingState {
  goals: Array<'fitness' | 'skin' | 'business' | 'discipline' | 'learning'>; // >= 1
  identityWhy: string;          // trimmed, 10–280 chars
  companion: CompanionId | null;
  personality: PersonalityId | null;
  environment: EnvironmentId | null;
  phone: string | null;         // E.164, e.g. "+15551234567"
  phoneVerified: boolean;
  smsPrefs: { morning: boolean; evening: boolean }; // both default true
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;                  // resume point
}
```

## First-SMS Templates (backend uses verbatim)

Placeholders: `{firstGoal}` = the user's first selected goal, lowercased noun ("fitness", "your skin", "your business", "discipline", "learning"). `{whyPhrase}` = the user's `identityWhy` compressed to a short clause by the backend (first sentence, lowercase first letter, trailing punctuation stripped; e.g. "you're tired of almost"). All under 300 chars including placeholders expanded to typical lengths.

| Personality | Template |
|---|---|
| **Coach** | `It's Kaizi — your coach. You told me why you're here: {whyPhrase}. That's our fuel. Day one starts with {firstGoal}. Text me back one small win you'll get before tonight. We build from there. Let's get to work.` |
| **Tough Love** | `Kaizi here. You said it yourself: {whyPhrase}. Words are cheap. {firstGoal} doesn't care how motivated you feel — it cares what you do. Text me the ONE thing you'll finish before sunset. No excuses, no essays.` |
| **Mentor** | `Hello — it's Kaizi. You wrote that {whyPhrase}. Keep that close; it's your compass when the path gets steep. We begin with {firstGoal}, one small promise at a time. Reply with the first step you'll take today, however small.` |
| **Supportive** | `Hi, it's Kaizi. I'm really glad you're here. You shared that {whyPhrase} — that took honesty, and I won't forget it. Let's start gently with {firstGoal}. What's one small thing you can do today? Whatever it is, I'm with you.` |
| **Rival** | `Kaizi here. So… {whyPhrase}? Bold. I've already logged my {firstGoal} progress today — have you? Didn't think so. Text me your first move. Every day one of us wins, and I don't plan on it being you. Prove me wrong.` |

Rules for backend: send within 5 minutes of handoff; respect quiet hours (no sends 21:30–07:30 local); if `{whyPhrase}` derivation fails, fall back to the phrase "you want to change" — never send a raw placeholder.
