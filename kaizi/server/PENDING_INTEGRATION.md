# Pending integration — Companion World backend

Built by the Companion World Backend Engineer as **new files only** (see
`docs/design/world-build-plan.md`). Nothing below has been applied to
`src/app.ts`, `src/index.ts`, or `.env.example` — those are shared files the
Confidence Engineer is/was concurrently editing. This document lists the
exact manual wiring the lead needs to apply by hand.

## 1. Mount the four new routers in `src/app.ts`

Each route file's default export is a **factory function** (not a bare
`Router` instance) — same DI shape as `createOnboardingRouter`/
`createSmsRouter` already in `app.ts` — because each needs the onboarding
`Db` (for phone -> `userId` lookup, since the new tables FK to `users`), the
new `WorldDb`, and the session token service for its own `requireAuth(...)`
call.

Add to the imports in `src/app.ts`:

```ts
import createChatRouter from "./routes/chat.js";
import createCustomizationRouter from "./routes/customization.js";
import createIntentionsRouter from "./routes/intentions.js";
import createJournalRouter from "./routes/journal.js";
import type { WorldDb } from "./db/world-types.js";
```

Add `worldDb: WorldDb;` to `CreateAppOptions`, then inside `createApp`, after
the existing `app.use("/api/sms", ...)` block:

```ts
app.use(
  "/api/intentions",
  createIntentionsRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
);
app.use(
  "/api/chat",
  createChatRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
);
app.use(
  "/api/customization",
  createCustomizationRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
);
app.use(
  "/api/journal",
  createJournalRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
);
```

Each of these four routers calls `router.use(requireAuth(sessionTokens))`
internally (imported from `middleware/auth.ts`, not edited) — no separate
`auth` middleware needs to be passed in from `app.ts` the way `/api/onboarding`
and `/api/sms` do it, since it's already applied inside each factory.
IP rate-limiting (`createVerifyIpRateLimit`) can optionally be added the same
way it's applied to the other route groups, at the lead's discretion — the
world routes don't currently have it.

## 2. Construct and pass a `WorldDb` in `src/index.ts`

`src/index.ts` currently constructs the onboarding `Db` (real Postgres via
`createPgDb(config.databaseUrl)`, or presumably a mock/in-memory path) and
passes it into `createApp(...)`. Add the analogous construction for the new
`WorldDb` using the **same** `config.databaseUrl`, then pass it through:

```ts
import { createPgWorldDb } from "./db/world-pg.js";
// ...
const worldDb = createPgWorldDb(config.databaseUrl);
// ...
const app = createApp({ db, sms, sessionTokens, worldDb, /* ...existing options */ });
```

There is no mock-mode split for `WorldDb` the way there is for `SmsService`
— Postgres is Postgres regardless of Twilio mock mode. Tests use
`src/db/world-memory.ts`'s `createMemoryWorldDb()` instead of
`createPgWorldDb`, mirroring how the onboarding tests use
`test/helpers/memory-db.ts` instead of `src/db/index.ts`.

## 3. `.env.example` — one new line

Add, in the same spirit as the existing Twilio comment block (uncommented
means live mode, commented/absent means mock mode):

```
# Anthropic API key for real companion chat (Claude). Leave unset for MOCK
# mode — the companion replies with a small pool of in-voice canned lines
# instead of calling the API (see src/services/claude-chat.ts). Get a key at
# https://console.anthropic.com (separate from any Claude subscription).
#ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`claude-chat.ts` reads `process.env.ANTHROPIC_API_KEY` directly (not via
`config.ts`), per the task brief, so no `config.ts` change is required for
this to work — only the documentation line above.

## 4. npm dependency

**Already done** — `@anthropic-ai/sdk@^0.111.0` was added to
`package.json` `dependencies` (one line, alphabetically placed before
`cors`) and `npm install` was run successfully. No action needed here.

## 5. Migration

**Already applied and verified** — `src/db/migrations/002_companion_world.sql`
was run against the real local Postgres (`npm run migrate`) alongside
`001_init.sql`; the resulting schema (`intentions`, `chat_messages`,
`companion_customization`, `journal_entries`) matches the migration file
exactly, and a second run confirmed idempotency (`No pending migrations.`).
No `001_init.sql` table was touched.

## Summary checklist for the lead

- [ ] Add the four `app.use(...)` blocks + `WorldDb` on `CreateAppOptions` in `src/app.ts`
- [ ] Construct `createPgWorldDb(config.databaseUrl)` and pass `worldDb` into `createApp(...)` in `src/index.ts`
- [ ] Add the `ANTHROPIC_API_KEY` line to `.env.example`
- [x] `@anthropic-ai/sdk` dependency added and installed
- [x] `002_companion_world.sql` migration written, applied, and verified idempotent against real Postgres
