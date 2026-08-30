# Tamago 🥚

A Tamagotchi-style prototype for **iOS and Android** (Expo / React Native) where you raise a
**tiny human that looks like you**: scan your face with the front camera and your selfie becomes
the head of a little cartoon person — shirt, arms, pants, shoes — who bounces around and needs
your care.

The face photo is stored only on the device (app document directory) and never uploaded.

## Features

- **Face scan onboarding** — front camera with an oval alignment guide; retake until you like it,
  name your tiny human, and bring them to life. A "Rescan face" button lets you swap the face
  later.
- **Classic Tamagotchi care loop** — four stats (fullness ⚡ energy 💖 happiness 🫧 hygiene) decay
  in real time, including while the app is closed (elapsed time is replayed on launch).
- **Actions** — Feed, Play (costs energy), Wash, and Sleep/Wake. Sleeping regenerates energy and
  slows decay; a fully rested pet wakes up on its own.
- **Moods** — ecstatic / happy / okay / grumpy / sick / asleep, derived from stats. Mood changes
  the shirt color, the emoji bubble, and the bounce speed; asleep dims the eyes.
- **Growth** — Baby → Kid → Adult by age, plus a care-based level (every 10 care actions).
- **Persistence** — state saved to AsyncStorage on every change.

## Run it

```bash
cd tamago
npm install
npx expo start
```

Scan the QR code with **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) /
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)) on a real phone —
the camera flow needs a physical device (simulators have no front camera).

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest — pure game-logic tests (decay, actions, sleep, moods, stages)
```

## Architecture

```
tamago/
├── App.tsx                     # routes: loading → scan → home (+ rescan)
└── src/
    ├── state/
    │   ├── petLogic.ts         # pure game rules — timestamps in, state out; fully unit-tested
    │   └── usePet.ts           # React hook: AsyncStorage persistence, 30s tick, foreground replay
    ├── screens/
    │   ├── ScanScreen.tsx      # expo-camera capture + preview/name + photo persistence
    │   └── HomeScreen.tsx      # tiny human, stat bars, action buttons
    ├── components/
    │   ├── TinyHuman.tsx       # face photo as the head of an animated little cartoon person
    │   └── StatBar.tsx
    └── theme.ts
```

## Prototype notes / next steps

- The whole selfie is center-cropped into a circle by the oval guide; a nicer version would
  auto-crop to the detected face bounds (e.g. with a face-detection library) and cut out the
  background.
- Sickness is cosmetic — a mini-game, medicine, and death/restart loop would complete the classic
  Tamagotchi mechanics.
- Local notifications ("Tama is hungry!") would make the real-time decay matter when the app is
  closed.
