/**
 * Companion World database interface — Intentions, companion chat,
 * post-onboarding customization, and the Reflection journal.
 *
 * This is a parallel, additive interface to ./types.ts (the onboarding
 * `Db` interface), kept in its own file so this phase's routes/tests never
 * touch onboarding.ts / types.ts / index.ts. The lead will merge the two
 * interfaces later. Mirrors the style of ./types.ts: plain row interfaces
 * plus one interface (`WorldDb`) that both the in-memory (./world-memory.ts)
 * and Postgres (./world-pg.ts) implementations satisfy.
 */

import type { Companion, Environment, Personality } from "../schemas.js";

export type IntentionStatus = "pending" | "kept" | "missed";
export type ChatRole = "user" | "companion";

export interface IntentionRow {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  reward_growth: number;
  /** Calendar date the intention applies to, e.g. "2026-07-11" (no time component). */
  scheduled_for: string;
  status: IntentionStatus;
  created_at: Date;
  kept_at: Date | null;
}

export interface CreateIntentionInput {
  title: string;
  subtitle?: string | null;
  rewardGrowth: number;
  /** "YYYY-MM-DD" */
  scheduledFor: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: Date;
}

export interface CompanionCustomizationRow {
  id: string;
  user_id: string;
  companion_species: Companion;
  personality: Personality;
  environment: Environment;
  updated_at: Date;
}

export interface CustomizationUpsertInput {
  companionSpecies: Companion;
  personality: Personality;
  environment: Environment;
}

export interface JournalEntryRow {
  id: string;
  user_id: string;
  content: string;
  created_at: Date;
}

export interface WorldDb {
  // Intentions
  createIntention(userId: string, input: CreateIntentionInput): Promise<IntentionRow>;
  /** Intentions scheduled for a given calendar date ("YYYY-MM-DD"), for one user. */
  listIntentionsForDate(userId: string, scheduledFor: string): Promise<IntentionRow[]>;
  /**
   * Atomically transitions an intention from "pending" to "kept" (stamping
   * kept_at = now()), scoped to the owning user. Returns the updated row, or
   * null if no matching pending intention exists for that user/id (already
   * kept/missed, wrong owner, or unknown id) — callers use null to return
   * 404/409 without a separate read-then-write race.
   */
  keepIntention(userId: string, intentionId: string): Promise<IntentionRow | null>;

  // Companion chat
  insertChatMessage(userId: string, role: ChatRole, content: string): Promise<ChatMessageRow>;
  /** Most recent messages for a user, oldest first, capped at `limit`. */
  listChatMessages(userId: string, limit?: number): Promise<ChatMessageRow[]>;

  // Companion customization (mutable any time post-onboarding)
  getCustomization(userId: string): Promise<CompanionCustomizationRow | null>;
  upsertCustomization(
    userId: string,
    input: CustomizationUpsertInput
  ): Promise<CompanionCustomizationRow>;

  // Reflection journal
  insertJournalEntry(userId: string, content: string): Promise<JournalEntryRow>;
  /** Most recent entries for a user, newest first, capped at `limit`. */
  listJournalEntries(userId: string, limit?: number): Promise<JournalEntryRow[]>;

  close(): Promise<void>;
}
