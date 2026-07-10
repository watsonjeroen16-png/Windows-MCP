# Kaizi Design Tokens

Source of truth: `kaizi/docs/design/kaizi_mvp_mockup.html`. This document is written to be
transcribed 1:1 into `app/src/ui/tokens.ts`. Names are given in `camelCase` as they should
appear in code. All rgba values are exact — do not round.

---

## 1. Color Palette

### 1.1 Grounds (dark ink backgrounds)

| Token | Value | Use |
|---|---|---|
| `ground.base` | `#0E0D0B` | Default app/phone background |
| `ground.deep` | `#0A0907` | Welcome screen base, lowest layer, foreground hill fill |
| `ground.warm` | `#0E0C09` | Welcome upper sky band |
| `ground.panel` | `#0B0A08` | Journey / Identity (list-heavy) screens |
| `ground.night` | `#080907` | Reflection / end-of-day screens (`#060808` as its deepest SVG layer) |
| `ground.gardenNight` | `#090C0A` | Zen-garden world base (green-shifted ink; layers `#0B0F0C`, `#0A0E0B`) |

Zen-garden scenery fills (SVG layers, use verbatim in ZenBackground):
`#1A1510`, `#221C14`, `#2A2218` (bamboo, welcome), `#141008`, `#0E0C08` (garden bed),
`#0F1A12`, `#0E1610`, `#0C1209`, `#0A1108`, `#0D1A0E`, `#111F12`, `#0F2010`, `#122514`,
`#1A2A16` (bamboo, world), `#1C1208`, `#1E1408`, `#2A1A08` (stones), `#3A2010`, `#2A1808` (lantern wood).

### 1.2 Core hues

| Token | Value | Use |
|---|---|---|
| `ink` | `#1C1A17` | Structural dark (from `:root --ink`) |
| `stone` | `#2E2B27` | Elevated dark neutral |
| `pebble` | `#4A4640` | Mid neutral, disabled strokes on dark |
| `cream` | `#F0EBE0` | Primary text |
| `sand` | `#C8B89A` | Secondary serif accents, active nav labels, taglines |
| `gold` | `#D4A853` | Reward, CTA accents, progress, selection |
| `fog` | `rgba(240,235,224,0.55)` | Soft overlay text |
| `blossom` | `rgba(230,180,190,0.7)` | Falling petal particles (variants: `rgba(220,160,175,0.6)`, `rgba(215,155,170,0.7)`, `rgba(200,140,155,0.4)`) |

### 1.3 Mist (white glass fills)

| Token | Value | Use |
|---|---|---|
| `mist.4` | `rgba(255,255,255,0.04)` | Quietest surfaces: settings rows, journal fields, photo placeholders |
| `mist.5` | `rgba(255,255,255,0.05)` | Secondary buttons, list cards, inputs |
| `mist.6` | `rgba(255,255,255,0.06)` | `:root --mist`, avatar frames |
| `mist.7` | `rgba(255,255,255,0.07)` | Standard glass-card fill, companion chat bubble, active nav-item bg |
| `mist.9` | `rgba(255,255,255,0.09)` | Promise card fill |
| `mist.10` | `rgba(255,255,255,0.10)` | `:root --mist2`; heavy glass fill; primary neutral pill (Begin) |
| `mist.16` | `rgba(255,255,255,0.16)` | `:root --mist3`; pressed/hover fills |

### 1.4 Hairline borders (white)

| Token | Value | Use |
|---|---|---|
| `line.5` | `rgba(255,255,255,0.05)` | Row separators inside grouped lists |
| `line.6` | `rgba(255,255,255,0.06)` | Tab-bar bottom border |
| `line.8` | `rgba(255,255,255,0.08)` | Card internal dividers, nav-pill top border, quiet card borders |
| `line.10` | `rgba(255,255,255,0.10)` | Inputs, secondary card borders |
| `line.12` | `rgba(255,255,255,0.12)` | Input borders, avatar frames, phone bezel |
| `line.14` | `rgba(255,255,255,0.14)` | Standard glass-card border |
| `line.18` | `rgba(255,255,255,0.18)` | Heavy glass border |
| `line.20` | `rgba(255,255,255,0.20)` | Promise-card border |
| `line.22` | `rgba(255,255,255,0.22)` | Primary neutral pill (Begin) border |

All borders are **0.5px** (React Native: `StyleSheet.hairlineWidth`).

### 1.5 Cream text alphas

| Token | Value | Use |
|---|---|---|
| `text.primary` | `#F0EBE0` (1.0) | Titles, key values |
| `text.body` | `rgba(240,235,224,0.7)` | List row labels, status icons |
| `text.soft` | `rgba(240,235,224,0.5)` | Inactive header labels |
| `text.muted` | `rgba(240,235,224,0.4)` | Tertiary labels, secondary button text |
| `text.faint` | `rgba(240,235,224,0.35)` | Footer microcopy, inactive nav, disabled labels |
| `text.micro` | `rgba(240,235,224,0.3)` | Uppercase micro-labels, section headers |
| `text.ghost` | `rgba(240,235,224,0.25)` | Chat sender labels, quiet section headers |
| `text.trace` | `rgba(240,235,224,0.2)` / `0.15` | Placeholders in empty tiles, "next up" hints |

### 1.6 Gold alphas

| Token | Value | Use |
|---|---|---|
| `gold.glow4` | `rgba(212,168,83,0.04)` | Outer ring of ambient glow orb |
| `gold.glow5` | `rgba(212,168,83,0.05)` | Mid glow ring |
| `gold.glow6` | `rgba(212,168,83,0.06)` | Inner glow ring, chart area fill |
| `gold.glow8` | `rgba(212,168,83,0.08)` | Innermost glow, quiet gold surface |
| `gold.fill10` | `rgba(212,168,83,0.10)` | Gold CTA pill fill (quiet), user chat bubble |
| `gold.fill12` | `rgba(212,168,83,0.12)` | "Promise kept" button fill, milestone icon bg |
| `gold.fill20` | `rgba(212,168,83,0.20)` | Selected chip / active gold button fill |
| `gold.line15` | `rgba(212,168,83,0.15)` | Quiet gold border |
| `gold.line20` | `rgba(212,168,83,0.20)` | Gold CTA pill border (quiet), user bubble border |
| `gold.line22` | `rgba(212,168,83,0.22)` | Gold pill border (Reflection CTA) |
| `gold.line25` | `rgba(212,168,83,0.25)` | "Promise kept" border, lantern glow fill |
| `gold.line30` | `rgba(212,168,83,0.30)` | Send-button border |
| `gold.line40` | `rgba(212,168,83,0.40)` | Selected chip border |
| `gold.ink50` | `rgba(212,168,83,0.50)` | Hairline divider, active tab underline, plan timestamps |
| `gold.ink60` | `rgba(212,168,83,0.60)` | Uppercase gold micro-labels, progress bars, chart stroke |
| `gold.ink70`–`1.0` | `rgba(212,168,83,0.70–1.0)` | Heatmap intensity ramp |
| `gold.icon90` | `rgba(212,168,83,0.90)` | Active nav icons, send arrow |
| `gold.solid` | `#D4A853` | Reward numbers, "Pro" badge, key gold text |

### 1.7 Misc

| Token | Value | Use |
|---|---|---|
| `shadow.figure` | `rgba(0,0,0,0.35)` | Companion ground-shadow ellipse |
| `scrim.nav` | `rgba(14,13,11,0.75)` | Bottom nav pill background |
| `scrim.sheet` | `rgba(14,13,11,0.82)` | Companion-world bottom sheet |
| `koi.red` | `rgba(200,80,60,0.6)` | Koi fish accent |
| `koi.gold` | `rgba(240,180,60,0.5)` | Koi fish accent |
| `skin.warm` | `#C8A882` | Human companion skin tone |
| `hair.dark` | `#1A1208` | Human companion hair |
| `robe.moss` | `#2A3525` / `#1E2A1A` | Companion robe fills |
| `eye.ink` | `#1A1A22` | Companion eyes (with `white` catchlight) |

---

## 2. Typography

Families:
- `font.serif` = `Cormorant Garamond` (fallback: Georgia, serif). Weights: 300, 400, 600; italics 300/400. **Serif = meaning**: titles, values, companion voice, taglines.
- `font.sans` = `Inter` (fallback: system). Weights: 300, 400, 500. **Sans = structure**: labels, buttons, user text, metadata.

RN note: load `CormorantGaramond_300Light`, `CormorantGaramond_300Light_Italic`, `CormorantGaramond_400Regular`, `CormorantGaramond_400Regular_Italic`, `Inter_300Light`, `Inter_400Regular`, `Inter_500Medium` via `expo-google-fonts`.

### Type scale

| Token | Family | Size | Weight | Style | Letter-spacing | Line-height | Use |
|---|---|---|---|---|---|---|---|
| `type.wordmark` | serif | 48 | 300 | normal | 0.12em | 1.0 | KAIZI wordmark |
| `type.display` | serif | 30–32 | 300 | normal | -0.01em | 1.1 | Promise card title, big stat values |
| `type.title` | serif | 28 | 300 | normal | -0.01em | 1.15 | Screen titles ("Your growth") |
| `type.stat` | serif | 26 | 300 | normal | 0 | 1.1 | Stat tile numbers |
| `type.heading` | serif | 22–24 | 300 | normal | 0.01em | 1.2 | Greetings, profile name |
| `type.reward` | serif | 18 | 400 | normal | 0 | 1.2 | Gold reward values ("+120 Growth") |
| `type.bodySerif` | serif | 15–16 | 300–400 | normal | 0 | 1.5 | Card row titles, list values |
| `type.voice` | serif | 15–16 | 300 | **italic** | 0 | 1.5–1.65 | **Companion voice** — every word the companion says is serif italic cream |
| `type.tagline` | serif | 16 | 300 | italic | 0.06em | 1.5 | Tagline under wordmark (sand) |
| `type.subSerif` | serif | 13–14 | 300 | italic | 0 | 1.4 | Italic subheads, dates, context labels |
| `type.bodySans` | sans | 13–14 | 400 | normal | 0 | 1.5 | User chat text, inputs, settings rows |
| `type.buttonLg` | sans | 14 | 400 | normal | 0.12em, UPPERCASE | 1 | Primary pill CTAs ("BEGIN") |
| `type.buttonSm` | sans | 11 | 400 | normal | 0.08–0.10em, UPPERCASE | 1 | Secondary pill CTAs |
| `type.tab` | sans | 10 | 400 | normal | 0.08em, UPPERCASE | 1 | Tabs, nav labels |
| `type.micro` | sans | 9 | 400 | normal | 0.10–0.12em, UPPERCASE | 1 | Micro-labels, section eyebrows ("TODAY'S PROMISE") |
| `type.meta` | sans | 10–12 | 400 | normal | 0.04–0.06em | 1.3 | Timestamps, progress %, metadata |

Rules:
- Micro-labels are always uppercase Inter 9–11px, letter-spacing 0.06–0.12em, in `text.micro`/`text.ghost` (or `gold.ink60` when gold).
- Companion speech is always quoted, serif italic 300, `cream`.
- Never set serif text below 12px; never set sans micro-labels above 11px.

---

## 3. Radii

| Token | Value | Use |
|---|---|---|
| `radius.xs` | 4 | Chat-bubble anchor corner, heatmap cells |
| `radius.sm` | 12 | Small action buttons, milestone icon tiles |
| `radius.md` | 14 | Photo tiles, plan rows |
| `radius.lg` | 16 | List cards, stat tiles, textareas |
| `radius.xl` | 18 | Stat cards, grouped setting lists, secondary action tiles |
| `radius.xxl` | 22 | Avatar frames |
| `radius.card` | 24 | Standard glass card, chat input |
| `radius.hero` | 28 | Promise card, heavy glass, bottom sheets (28 28 0 0) |
| `radius.pill` | 999 | All pill buttons and chips |
| `radius.device` | 50 | Phone frame (mockup only) |

Chat bubbles: companion `4 / 16 / 16 / 16` (anchor top-left); user `16 / 4 / 16 / 16` (anchor top-right).

---

## 4. Spacing

Base-4 scale: `4, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 60`.

| Token | Value | Use |
|---|---|---|
| `space.xxs` | 4 | Icon–label gaps |
| `space.xs` | 8 | Grid gaps (tight), stacked list gaps |
| `space.sm` | 12 | Button rows, card grid gaps |
| `space.md` | 16 | Card padding (compact), inter-element |
| `space.lg` | 20 | Card padding (default), section gaps |
| `space.xl` | 24 | Screen horizontal padding (dense screens) |
| `space.xxl` | 28 | Screen horizontal padding (hero screens), promise-card padding |
| `space.xxxl` | 32 | CTA horizontal inset, hero card padding |
| `space.jumbo` | 40 | Welcome content inset |
| `space.footer` | 60 | Bottom CTA clearance |

Fixed heights: status bar 54; bottom nav pill 86; pill CTA padding-vertical 16–18.

---

## 5. Animation Vocabulary

Global feel: **quiet motion** — slow, small-amplitude, ease-in-out, infinitely looping ambience; fast easing reserved for user-triggered transitions. Respect `Reduce Motion` (freeze ambient loops, keep transitions).

| Name | Keyframes (description) | Duration | Easing | Where used |
|---|---|---|---|---|
| `blossom-fall` | translateY(-10px→820px), translateX(0→60px), rotate(0→180deg); opacity 0→0.7 (10%)→0.5 (90%)→0 | 8–18s, staggered delays 0–5s | linear | Falling petals on Welcome, world, ambient screens (2–4 at a time) |
| `bamboo-sway` | rotate(0→1.5deg→0), transform-origin bottom center | 4–5s | ease-in-out | Bamboo stalks, tall scenery; stagger 0.3–1.4s |
| `water-ripple` | scale(1→1.15→1), opacity 0.3→0.1→0.3 | 3–4s | ease-in-out | Pond ellipses; second ring offset 0.5–1s |
| `lantern-glow` | opacity 0.5→0.8→0.5 | 3s | ease-in-out | Lantern light, ambient gold glow orb; stagger 0.7–1.2s |
| `idle-sway` | translateY(0→-2px→0) | 4s | ease-in-out | Companion idle breathing (whole figure) |
| `koi-swim` | translateX(0→30px→0) with scaleX flip at midpoint | 6s | ease-in-out | Koi dots in pond; stagger 2s |
| `particle-rise` | translateY(0→-40px), opacity 0→0.4 (50%)→0 | 4–6s | ease-in-out | Gold motes rising near ground; stagger 1.5–3s |
| `fog-drift` | translateX(-5%→5%) | 10s | ease-in-out, alternate | Low fog band across scenery |
| `card-slide-in` | translateX(100%)+rotate(4deg)+opacity 0 → identity | 380ms | ease-out | Next card/screen content entering |
| `swipe-right` | translateX(0→130%), rotate(0→8deg), opacity 1→0 | 400ms | ease-out | Positive dismiss ("Promise kept") |
| `swipe-left` | translateX(0→-130%), rotate(0→-8deg), opacity 1→0 | 400ms | ease-out | Negative dismiss ("Remind later") |
| `xp-pop` | scale(0.7)+opacity 0 → scale(1.1) at 60% → scale(1)+opacity 1 | ~350ms | ease-out (overshoot) | Reward reveals, selection confirmations, code-box fill |
| micro-transition | color/opacity/background cross-fade | 250ms | ease-out | Nav items, tabs, chip state changes |
| press feedback | transform on press | 120ms | ease-out | Cards, buttons (scale 0.98) |

---

## 6. Component Surface Recipes

### `glassCard` (standard)
- fill `mist.7` · border 0.5px `line.14` · radius `radius.card` (24)
- padding 16–20 · no shadow (glass reads via border + fill, not elevation)

### `glassSubtle` (list rows, stat tiles)
- fill `mist.4`–`mist.5` · border 0.5px `line.8` · radius 16–18

### `glassHeavy` (hero cards, sheets)
- fill `mist.10` · border 0.5px `line.18` · radius `radius.hero` (28)
- Bottom sheet variant: fill `scrim.sheet`, border `line.10`, radius 28 28 0 0, no bottom border

### `goldButton` (gold CTA pill)
- Quiet: fill `gold.fill10` · border 0.5px `gold.line20`–`gold.line22` · radius `radius.pill` · padding-v 16 · text `type.buttonSm` in `gold.solid`
- Emphatic (selected/confirm): fill `gold.fill20` · border `gold.line40` · same text
- Hero neutral variant (Begin): fill `mist.10` · border `line.22` · padding-v 18 · text `type.buttonLg` in `cream`

### `secondaryButton`
- fill `mist.4`–`mist.5` · border 0.5px `line.8`–`line.10` · radius `radius.pill` · text `type.buttonSm` in `text.faint`

### `chip` states (pill, radius 999, padding 10–12 v / 18–20 h, `type.buttonSm`)
| State | Fill | Border | Text |
|---|---|---|---|
| Default | transparent | `rgba(255,255,255,0.15)` | `text.soft` |
| Selected | `gold.fill20` | `gold.line40` | `gold.solid` |
| Pressed | `mist.16` | `line.22` | `cream` |
| Disabled | transparent | `line.8` | `text.trace` |
Transition: 250ms ease-out; selection adds `xp-pop` once.

### `input` (text field / textarea)
- fill `mist.4`–`mist.5` · border 0.5px `line.10`–`line.12` · radius 16 (multiline) or `radius.pill` (single-line chat)
- text `type.bodySans` `cream` · placeholder `text.faint` · line-height 1.6
- Focus: border → `line.22`; error: border → `rgba(200,80,60,0.5)` with `type.meta` message below in `rgba(230,140,120,0.8)`

### `chatBubble`
- Companion: fill `mist.7`, border `line.10`, radius 4/16/16/16, `type.voice`, sender micro-label above in `text.ghost`
- User: fill `gold.fill10`, border `gold.line20`, radius 16/4/16/16, `type.bodySans`

### `progressBar`
- Track: 3px, `line.8`, radius 999 · Fill: `gold.ink60`, radius 999

### `navPill`
- Height 86, fill `scrim.nav`, top border 0.5px `line.8`
- Item: icon 20px stroke 1.5 + `type.tab` label; inactive icon/label `text.faint` at opacity 0.3–0.35; active bg `rgba(255,255,255,0.07)` radius 16, icon `gold.icon90`, label `sand`

### `divider` (gold hairline)
- 40 × 0.5px, `gold.ink50`, centered — used under the wordmark and as a ceremonial separator
