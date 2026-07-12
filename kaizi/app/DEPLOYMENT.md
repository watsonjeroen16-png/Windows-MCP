# Kaizi App — Build & App-Store Submission (EAS)

This guide covers building the Expo app with EAS Build and submitting it to
TestFlight / the App Store and Google Play. **Do not run a production build
or submission until the Retention Architect's screen-restructure mockup is
approved and built** — see `kaizi/docs/DEPLOYMENT-READINESS.md`. The
`eas.json` and this guide are ready now so that, once the app is ready to
ship, there's no infrastructure work left to do — only the decision to press
go.

## 0. Founder decisions this guide assumes (see below if not yet made)

`kaizi/app/app.json` currently has **placeholder** values that a real launch
must not ship with:

- `ios.bundleIdentifier` / `android.package`: both set to `com.kaizi.app` —
  a placeholder reverse-DNS identifier. If Kaizi doesn't yet have a
  registered domain/company name to base a real identifier on, this is fine
  to keep, **but it must be finalized before the first production build**,
  because bundle identifiers are effectively permanent once submitted to
  either store (changing later means a new app listing, not an update).
- `eas.json`'s `submit.production` block has `REPLACE_WITH_*` placeholders
  for Apple ID, App Store Connect app ID, Apple Team ID, and expects a
  `google-play-service-account.json` file that doesn't exist yet — these
  can only be filled in once the founder has the actual Apple
  Developer/Google Play accounts (§3, §4 below).
- `eas.json`'s `preview`/`production` build profiles have
  `REPLACE_WITH_..._SERVER_URL` placeholders for `EXPO_PUBLIC_API_URL` —
  fill in the real deployed server URL once `kaizi/server/DEPLOYMENT.md` has
  been carried out (must be `https://`, per the release-build gate in
  `src/api/client.ts`).

## 1. EAS account & project setup (one-time)

1. Create a free Expo account at **https://expo.dev/signup** if the founder
   doesn't have one.
2. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. From `kaizi/app/`, link the project to an EAS project (this generates a
   real `projectId` and writes it into `app.json` under `extra.eas.projectId`
   — that field is intentionally absent right now since it can't be created
   without a live EAS login):
   ```bash
   cd kaizi/app
   eas init
   ```
4. Confirm the three build profiles are present:
   ```bash
   eas build:list --json | head   # sanity check CLI auth
   cat eas.json                   # development / preview / production profiles
   ```

## 2. Build profiles (already configured in `eas.json`)

| Profile | Purpose | Distribution | Android output | iOS |
|---|---|---|---|---|
| `development` | Local dev client for testing native modules without Expo Go | internal | `.apk` | dev-client build |
| `preview` | Internal testing (TestFlight internal / ad-hoc, Play internal track) | internal | `.apk` | ad-hoc/internal |
| `production` | Store submission | store | `.aab` (App Bundle, required by Play) | store archive |

Build commands:

```bash
cd kaizi/app
eas build --profile development --platform ios      # or android / all
eas build --profile preview --platform all           # TestFlight/internal testers
eas build --profile production --platform all        # store submission build
```

`appVersionSource: "local"` in `eas.json` means version/build numbers come
from `app.json` (`version`, `ios.buildNumber`, `android.versionCode`) rather
than EAS's remote counter — bump these before each store submission.
`production` also sets `autoIncrement: true` so EAS bumps `buildNumber`/
`versionCode` automatically on each production build; still bump the
human-facing `version` (e.g. `1.0.0` → `1.0.1`) by hand for each release.

## 3. Apple Developer Program (required for iOS distribution)

1. Enroll at **https://developer.apple.com/programs/enroll/** — **$99/year**,
   requires an Apple ID. If enrolling as an organization (recommended for a
   real company) rather than an individual, budget extra time: Apple verifies
   the organization (D-U-N-S number lookup, sometimes a phone call), which
   can take anywhere from a day to a couple of weeks.
2. Once enrolled, create the app's listing in
   **App Store Connect** (https://appstoreconnect.apple.com) → **My Apps** →
   **+** → **New App**. Use the same bundle identifier as `app.json`'s
   `ios.bundleIdentifier`.
3. Note the **Apple Team ID** (developer.apple.com → Membership) and the
   **App Store Connect App ID** (App Store Connect → app → App Information →
   Apple ID, a numeric value) — both go into `eas.json`'s
   `submit.production.ios` block, replacing the `REPLACE_WITH_*`
   placeholders.
4. Submit:
   ```bash
   eas submit --platform ios --profile production
   ```
   First submission requires interactive Apple sign-in (and 2FA) unless an
   App Store Connect API key is configured instead — see
   [EAS submit docs](https://docs.expo.dev/submit/ios/) for the API-key
   alternative if the founder wants to automate this in CI later.

## 4. Google Play Developer account (required for Android distribution)

1. Register at **https://play.google.com/console/signup** — **$25 one-time**
   fee.
2. Create the app in Play Console → **Create app**, using the same package
   name as `app.json`'s `android.package`.
3. Create a **service account** for automated submission: Play Console →
   Setup → API access → link a Google Cloud project → create a service
   account with the "Release manager" role → download its JSON key.
4. Save that key as `kaizi/app/google-play-service-account.json` (this
   filename is already referenced in `eas.json`'s `submit.production.android`
   — **do not commit this file**; add it to `.gitignore` if not already
   covered, since it's a real credential).
5. Submit:
   ```bash
   eas submit --platform android --profile production
   ```
   New apps must go through Play's initial review + a closed testing track
   with a minimum tester count before Play allows a production release —
   budget a few days to a couple of weeks for a brand-new developer account
   (Play's "new developer" requirements are stricter than they used to be).

## 5. What the founder must provide/decide before this can actually ship

This is the mobile-specific subset; the consolidated list across the whole
project (including the server) is in `kaizi/docs/DEPLOYMENT-READINESS.md`,
and the beginner-friendly step-by-step for getting each credential is in
`kaizi/docs/GETTING-CREDENTIALS.md`.

- **Apple Developer Program membership** — $99/year, founder's own Apple ID.
- **Google Play Developer account** — $25 one-time, founder's own Google
  account.
- **Final bundle identifiers** — replace the `com.kaizi.app` placeholder in
  `app.json` with a real reverse-DNS identifier if/when Kaizi has a
  registered domain or company name to base it on (or confirm
  `com.kaizi.app` is fine to keep — it's a valid, available-looking
  identifier, just unverified as actually reserved/desired long-term).
- **App icon / splash assets** — `kaizi/app/assets/` has `icon.png`,
  `android-icon-*.png`, `favicon.png`, `splash-icon.png` already in place
  from the onboarding build; confirm with the founder whether these are
  final production-quality assets or placeholders pending the Retention
  Architect's redesign (a store listing needs a polished 1024×1024 icon at
  minimum).
- **App Store listing copy + screenshots** — title, subtitle, description,
  keywords, category, and screenshots for each required device size. Not
  started; blocked on the screen redesign per
  `kaizi/docs/DEPLOYMENT-READINESS.md`.
- **Privacy policy URL** — **required by both stores**, not optional
  boilerplate. Kaizi collects phone numbers (Twilio verification) and
  personal reflections (journal entries, chat messages, "why" answers) — this
  is exactly the kind of personal data both Apple and Google require a
  privacy policy to disclose. Needs a real hosted URL (even a simple static
  page) before either store submission can be completed. No such document
  exists in this repository yet.
- **EAS/Expo account** — free, but someone needs to actually run `eas login`
  / `eas init` under a real account before any `eas build` command in this
  guide will work; `app.json` has no `extra.eas.projectId` yet for exactly
  this reason.
- **Apple Team ID / App Store Connect App ID / Google Play service account
  JSON** — all depend on the two store accounts above existing first; the
  `eas.json` `submit` block has explicit placeholders for these.
