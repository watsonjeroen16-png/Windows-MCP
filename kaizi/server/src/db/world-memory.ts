/**
 * In-memory WorldDb implementation for tests — no live Postgres required.
 * Mirrors the style of test/helpers/memory-db.ts (the onboarding equivalent),
 * but lives under src/ (not test/) so both the test suite and any future
 * local/dev "no database" mode can import it.
 */

import { randomUUID } from "node:crypto";

import type {
  ChatMessageRow,
  ChatRole,
  CompanionCustomizationRow,
  CreateIntentionInput,
  CustomizationUpsertInput,
  IntentionRow,
  JournalEntryRow,
  WorldDb,
} from "./world-types.js";

export interface MemoryWorldDb extends WorldDb {
  readonly intentions: Map<string, IntentionRow>; // keyed by intention id
  readonly chatMessages: ChatMessageRow[];
  readonly customizations: Map<string, CompanionCustomizationRow>; // keyed by user id
  readonly journalEntries: JournalEntryRow[];
}

export function createMemoryWorldDb(): MemoryWorldDb {
  const intentions = new Map<string, IntentionRow>();
  const chatMessages: ChatMessageRow[] = [];
  const customizations = new Map<string, CompanionCustomizationRow>();
  const journalEntries: JournalEntryRow[] = [];

  return {
    intentions,
    chatMessages,
    customizations,
    journalEntries,

    async createIntention(userId: string, input: CreateIntentionInput): Promise<IntentionRow> {
      const row: IntentionRow = {
        id: randomUUID(),
        user_id: userId,
        title: input.title,
        subtitle: input.subtitle ?? null,
        reward_growth: input.rewardGrowth,
        scheduled_for: input.scheduledFor,
        status: "pending",
        created_at: new Date(),
        kept_at: null,
      };
      intentions.set(row.id, row);
      return row;
    },

    async listIntentionsForDate(userId: string, scheduledFor: string): Promise<IntentionRow[]> {
      return [...intentions.values()]
        .filter((row) => row.user_id === userId && row.scheduled_for === scheduledFor)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    },

    async keepIntention(userId: string, intentionId: string): Promise<IntentionRow | null> {
      const row = intentions.get(intentionId);
      if (!row || row.user_id !== userId || row.status !== "pending") return null;
      row.status = "kept";
      row.kept_at = new Date();
      return row;
    },

    async insertChatMessage(
      userId: string,
      role: ChatRole,
      content: string
    ): Promise<ChatMessageRow> {
      const row: ChatMessageRow = {
        id: randomUUID(),
        user_id: userId,
        role,
        content,
        created_at: new Date(),
      };
      chatMessages.push(row);
      return row;
    },

    async listChatMessages(userId: string, limit = 50): Promise<ChatMessageRow[]> {
      return chatMessages
        .filter((row) => row.user_id === userId)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(-limit);
    },

    async getCustomization(userId: string): Promise<CompanionCustomizationRow | null> {
      return customizations.get(userId) ?? null;
    },

    async upsertCustomization(
      userId: string,
      input: CustomizationUpsertInput
    ): Promise<CompanionCustomizationRow> {
      const existing = customizations.get(userId);
      const row: CompanionCustomizationRow = {
        id: existing?.id ?? randomUUID(),
        user_id: userId,
        companion_species: input.companionSpecies,
        personality: input.personality,
        environment: input.environment,
        updated_at: new Date(),
      };
      customizations.set(userId, row);
      return row;
    },

    async insertJournalEntry(userId: string, content: string): Promise<JournalEntryRow> {
      const row: JournalEntryRow = {
        id: randomUUID(),
        user_id: userId,
        content,
        created_at: new Date(),
      };
      journalEntries.push(row);
      return row;
    },

    async listJournalEntries(userId: string, limit = 50): Promise<JournalEntryRow[]> {
      return journalEntries
        .filter((row) => row.user_id === userId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    },

    async close(): Promise<void> {
      // nothing to release
    },
  };
}
