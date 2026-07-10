-- Kaizi onboarding — initial schema.
-- Users are keyed by verified E.164 phone (phone-only identity, see architecture.md).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text UNIQUE NOT NULL,
    phone_verified_at timestamptz,
    welcomed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_profiles (
    user_id uuid UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goals text[] NOT NULL,
    identity_why text NOT NULL,
    companion text NOT NULL,
    personality text NOT NULL,
    environment text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_preferences (
    user_id uuid UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    morning boolean NOT NULL DEFAULT true,
    evening boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind text NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_entries_user_id_idx ON memory_entries (user_id);
