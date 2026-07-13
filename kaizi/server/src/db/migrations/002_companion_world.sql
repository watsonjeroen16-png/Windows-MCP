-- Kaizi Companion World — additive schema for the post-onboarding core app
-- (Home, companion chat, Intentions, customization, Reflection journal).
-- Additive only: never modifies 001_init.sql. "Promise" -> "Intentions" per
-- founder decision, see docs/design/world-build-plan.md.

-- Daily habit/commitment instances (renamed "Promises" -> "Intentions").
CREATE TABLE IF NOT EXISTS intentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title text NOT NULL,
    subtitle text,
    reward_growth integer NOT NULL DEFAULT 0,
    scheduled_for date NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'missed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    kept_at timestamptz
);

CREATE INDEX IF NOT EXISTS intentions_user_id_idx ON intentions (user_id);
CREATE INDEX IF NOT EXISTS intentions_user_id_scheduled_for_idx ON intentions (user_id, scheduled_for);

-- Companion chat transcript (also feeds future "memory echo" retrieval).
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'companion')),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_created_at_idx ON chat_messages (user_id, created_at);

-- Mutable post-onboarding companion customization. Unlike onboarding's
-- one-time companion/personality/environment choice, this can change any
-- time (founder's "more customization" ask) — one row per user.
CREATE TABLE IF NOT EXISTS companion_customization (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    companion_species text NOT NULL,
    personality text NOT NULL,
    environment text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reflection screen entries (also the future source for "memory echo"
-- selection — see docs/design/world-spec.md #3; only storage is built here).
CREATE TABLE IF NOT EXISTS journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx ON journal_entries (user_id);
CREATE INDEX IF NOT EXISTS journal_entries_user_id_created_at_idx ON journal_entries (user_id, created_at);
