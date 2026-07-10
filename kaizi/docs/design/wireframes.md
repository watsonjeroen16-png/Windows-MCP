# Kaizi — Wireframe System (Full App)

Source: founder-provided wireframe spec (July 2026). The interactive mockup lives at
`kaizi/docs/design/kaizi_mvp_mockup.html` and is the visual source of truth for the
design system (colors, type, glassmorphism, animation language).

## A. App Structure

Five main frames:

1. Onboarding Flow
2. Home (Mission Hub)
3. Companion World (Core Experience)
4. Progress (Journey)
5. Profile (Identity)

## B. Onboarding Flow  ← CURRENT BUILD SCOPE

### Frame 1 — Welcome
- Center animated companion idle loop (Lottie/Spine later; SVG/Reanimated for MVP)
- Title: "Build a life that builds you back"
- CTA button

### Frame 2 — Goal Selection
- Grid of selectable chips
- Categories: Fitness / Skin / Business / Discipline / Learning
- Bottom button: Continue

### Frame 3 — Identity Input
- Full screen text input
- Prompt: "Why are you doing this?"
- Save button → memory system

### Frame 4 — Companion Selection
Grid cards, each with looping idle animation preview, tap to select:
- Wolf Pup
- Fox
- Lion
- Dog
- Human Male / Female
- Dragonkin

### Frame 5 — Personality Selection
Cards, each with a sample dialogue preview:
- Coach
- Tough Love
- Mentor
- Supportive
- Rival

### Frame 6 — Environment Selection
Full screen 3x4 grid, each tile a subtle animated background loop:
- Cyber City (neon) · Modern Apartment · Forest Village · Mountain Retreat
- Dojo · Coastal Paradise · Fantasy Kingdom · Space Colony
- Japanese Garden (Zen Garden in mockup) · Training Campus · Entrepreneur District · Sky Islands

### Frame 7 — SMS Setup
- Phone input (the ONLY contact detail collected — SMS via Twilio)
- Toggles: Morning plan · Evening check-in

## C. Home Screen (Mission Hub)
Not chat — a control center. Top bar: XP level, XP progress circle (top corner),
consistency %, streak, daily progress bar. Center: big vertical Daily Mission card
(checkbox missions with XP rewards, "4/6 complete" bar). Quick actions: Add Goal,
Log Workout, Add Habit, Open Companion. Mini idle companion in bottom corner that
reacts when XP is earned.

## D. Companion World (Core Experience)
Full-screen animated environment render (3D or parallax 2.5D), companion idle
animation, environmental motion (wind, lighting, NPCs later). Bottom glass overlay
panel with tabs: 💬 Chat · 📅 Daily Plan · 📸 Photos · 🧠 Reflection · 🎯 Goals.
Chat overlays the world with companion visible and reacting. Photo mode uploads
body/skin photos with an AI feedback panel. Daily Plan shows the AI-generated
schedule. Reflection is a text input saved to memory.

## E. Progress Screen
XP timeline graph (level progression line), consistency calendar heatmap,
milestone cards (7-day streak, 30 workouts, transformation), scrollable
before/after photo timeline.

## F. Profile Screen
Subscription, environment selector, companion selector, notification settings,
memory reset/export (important for trust), and a Consistency % × XP leaderboard
(new metric).
