/**
 * Database access interface. The Express app depends on this interface only,
 * so tests can inject an in-memory implementation (no live Postgres needed)
 * and production wires the pg-backed implementation from ./index.ts.
 */

import type { Companion, Environment, Goal, Personality, QuizAnswers } from "../schemas.js";

export interface UserRow {
  id: string;
  phone: string;
  phone_verified_at: Date | null;
  welcomed_at: Date | null;
  created_at: Date;
}

export interface ProfileRow {
  user_id: string;
  goals: Goal[];
  identity_why: string;
  companion: Companion;
  personality: Personality;
  environment: Environment;
  created_at: Date;
  updated_at: Date;
}

export interface SmsPreferencesRow {
  user_id: string;
  morning: boolean;
  evening: boolean;
  updated_at: Date;
}

export interface ProfileUpsertInput {
  goals: Goal[];
  identityWhy: string;
  companion: Companion;
  personality: Personality;
  environment: Environment;
}

export interface ProfileUpsertResult {
  created: boolean;
  /** identity_why value before this upsert (null when newly created). */
  previousIdentityWhy: string | null;
}

export interface UserWithProfile {
  user: UserRow;
  profile: ProfileRow | null;
  smsPrefs: SmsPreferencesRow | null;
}

export interface QuizResponsesRow {
  user_id: string;
  quiz_version: number;
  answers: QuizAnswers;
  skipped_entirely: boolean;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface QuizResponsesUpsertInput {
  answers: QuizAnswers;
  skippedEntirely: boolean;
}

export interface QuizResponsesUpsertResult {
  created: boolean;
  row: QuizResponsesRow;
}

export interface Db {
  getUserByPhone(phone: string): Promise<UserRow | null>;
  /** Insert-or-update user by phone, stamping phone_verified_at = now(). */
  upsertVerifiedUser(phone: string): Promise<UserRow>;
  upsertProfile(userId: string, input: ProfileUpsertInput): Promise<ProfileUpsertResult>;
  upsertSmsPreferences(userId: string, prefs: { morning: boolean; evening: boolean }): Promise<void>;
  insertMemoryEntry(userId: string, kind: string, content: string): Promise<void>;
  getUserWithProfile(phone: string): Promise<UserWithProfile | null>;
  /**
   * Atomically transitions welcomed_at from unset to now(), only if it was
   * still unset. Returns true if this call won the transition (the caller
   * should proceed to send), false if another call already claimed it (the
   * caller must not send again) — closes a TOCTOU race where two concurrent
   * /api/sms/welcome requests could both pass the "not yet welcomed" check
   * and both trigger a real Twilio send.
   */
  markWelcomed(userId: string): Promise<boolean>;

  // Onboarding quiz (personalization-spec.md section 1). Upsert is
  // idempotent: re-submitting for the same user replaces the previous
  // answers, mirroring upsertProfile's re-post semantics. `completed_at` is
  // stamped now() on every upsert (a full submission — a skip records
  // skippedEntirely instead of leaving completed_at null, since "the user
  // finished this onboarding step" is true either way).
  upsertQuizResponses(
    userId: string,
    input: QuizResponsesUpsertInput
  ): Promise<QuizResponsesUpsertResult>;
  getQuizResponses(userId: string): Promise<QuizResponsesRow | null>;

  close(): Promise<void>;
}
