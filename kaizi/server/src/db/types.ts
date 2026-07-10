/**
 * Database access interface. The Express app depends on this interface only,
 * so tests can inject an in-memory implementation (no live Postgres needed)
 * and production wires the pg-backed implementation from ./index.ts.
 */

import type { Companion, Environment, Goal, Personality } from "../schemas.js";

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

export interface Db {
  getUserByPhone(phone: string): Promise<UserRow | null>;
  /** Insert-or-update user by phone, stamping phone_verified_at = now(). */
  upsertVerifiedUser(phone: string): Promise<UserRow>;
  upsertProfile(userId: string, input: ProfileUpsertInput): Promise<ProfileUpsertResult>;
  upsertSmsPreferences(userId: string, prefs: { morning: boolean; evening: boolean }): Promise<void>;
  insertMemoryEntry(userId: string, kind: string, content: string): Promise<void>;
  getUserWithProfile(phone: string): Promise<UserWithProfile | null>;
  markWelcomed(userId: string): Promise<void>;
  close(): Promise<void>;
}
