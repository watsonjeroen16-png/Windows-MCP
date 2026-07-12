-- Kaizi Personalization — onboarding quiz persistence + intention provenance.
-- Additive only: never modifies 001_init.sql or 002_companion_world.sql.
-- Built per docs/design/personalization-spec.md section 1 (quiz) and section
-- 3 (quiz-derived intention generation). Screen-time (spec section 2) is CUT
-- by founder decision and has no schema here.

-- (1) Distinguish user-authored vs companion-suggested intentions. Needed by
-- the v3 mockup's "Yours today" section (kaizi_v3_mockup.html) and by the new
-- intention-generation service below, which must mark its output distinctly
-- from intentions a user typed in themselves.
ALTER TABLE intentions
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user'
        CHECK (source IN ('user', 'companion'));

-- (2) The 10-question onboarding quiz (personalization-spec.md section 1.5).
-- One row per user. A JSONB blob rather than normalized columns per question:
-- quiz answers primarily feed a text digest into a Claude system prompt
-- (section 3), not per-question SQL filtering/analytics, so locking the
-- schema to today's exact 10 questions would be premature. Revisit with
-- normalized/generated columns only if per-question analytics dashboards are
-- wanted later (see spec section 4, open question 4).
CREATE TABLE IF NOT EXISTS onboarding_quiz_responses (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    quiz_version smallint NOT NULL DEFAULT 1,
    answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- shape: { "focusGoal": "fitness", "startingPoint": "restarting",
    --          "obstacle": "distractions", "supportStyle": "direct",
    --          "availability": ["morning", "evening"], "motivationStyle": "results",
    --          "pastAttempts": "triedAppsDidntStick", "confidence": "fairly",
    --          "rhythm": "flexible", "ninetyDayVision": "measurableResult" }
    -- unanswered/skipped questions are simply absent from the object.
    skipped_entirely boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
