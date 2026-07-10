/**
 * In-memory Db implementation for tests — no live Postgres required.
 */

import { randomUUID } from "node:crypto";

import type {
  Db,
  ProfileRow,
  ProfileUpsertInput,
  ProfileUpsertResult,
  SmsPreferencesRow,
  UserRow,
  UserWithProfile,
} from "../../src/db/types.js";

export interface MemoryEntry {
  id: string;
  user_id: string;
  kind: string;
  content: string;
  created_at: Date;
}

export interface MemoryDb extends Db {
  readonly users: Map<string, UserRow>; // keyed by phone
  readonly profiles: Map<string, ProfileRow>; // keyed by user id
  readonly smsPrefs: Map<string, SmsPreferencesRow>; // keyed by user id
  readonly memories: MemoryEntry[];
}

export function createMemoryDb(): MemoryDb {
  const users = new Map<string, UserRow>();
  const profiles = new Map<string, ProfileRow>();
  const smsPrefs = new Map<string, SmsPreferencesRow>();
  const memories: MemoryEntry[] = [];

  return {
    users,
    profiles,
    smsPrefs,
    memories,

    async getUserByPhone(phone: string): Promise<UserRow | null> {
      return users.get(phone) ?? null;
    },

    async upsertVerifiedUser(phone: string): Promise<UserRow> {
      const existing = users.get(phone);
      if (existing) {
        existing.phone_verified_at = new Date();
        return existing;
      }
      const user: UserRow = {
        id: randomUUID(),
        phone,
        phone_verified_at: new Date(),
        welcomed_at: null,
        created_at: new Date(),
      };
      users.set(phone, user);
      return user;
    },

    async upsertProfile(userId: string, input: ProfileUpsertInput): Promise<ProfileUpsertResult> {
      const existing = profiles.get(userId);
      const previousIdentityWhy = existing?.identity_why ?? null;
      profiles.set(userId, {
        user_id: userId,
        goals: input.goals,
        identity_why: input.identityWhy,
        companion: input.companion,
        personality: input.personality,
        environment: input.environment,
        created_at: existing?.created_at ?? new Date(),
        updated_at: new Date(),
      });
      return { created: !existing, previousIdentityWhy };
    },

    async upsertSmsPreferences(
      userId: string,
      prefs: { morning: boolean; evening: boolean }
    ): Promise<void> {
      smsPrefs.set(userId, { user_id: userId, ...prefs, updated_at: new Date() });
    },

    async insertMemoryEntry(userId: string, kind: string, content: string): Promise<void> {
      memories.push({ id: randomUUID(), user_id: userId, kind, content, created_at: new Date() });
    },

    async getUserWithProfile(phone: string): Promise<UserWithProfile | null> {
      const user = users.get(phone);
      if (!user) return null;
      return {
        user,
        profile: profiles.get(user.id) ?? null,
        smsPrefs: smsPrefs.get(user.id) ?? null,
      };
    },

    async markWelcomed(userId: string): Promise<void> {
      for (const user of users.values()) {
        if (user.id === userId) {
          user.welcomed_at = new Date();
          return;
        }
      }
    },

    async close(): Promise<void> {
      // nothing to release
    },
  };
}
