/**
 * The World's zone travel strip (app-restructure-v3.md section 4.1). Same
 * continuous garden — shared sky/companion/time-of-day — but each zone has
 * its own distinct visual identity (see ui/ZoneBackground.tsx) and gates on
 * whether the user picked the matching onboarding goal(s), per this round's
 * brief. (world-spec.md's streak-based gating is a later refinement — the
 * backend doesn't track per-goal streaks yet; see app-restructure-v3.md
 * section 5 #1, not built.)
 */
import type { GoalId } from "./ids";

export type ZoneId = "courtyard" | "training" | "study" | "spring";

export interface ZoneMeta {
  id: ZoneId;
  label: string;
  caption: string;
  /** Goals that unlock this zone; empty = always unlocked. */
  requiresAnyGoal: readonly GoalId[];
  lockedHint: string | null;
}

export const ZONES: readonly ZoneMeta[] = [
  {
    id: "courtyard",
    label: "The Courtyard",
    caption: "The Courtyard · always yours",
    requiresAnyGoal: [],
    lockedHint: null,
  },
  {
    id: "training",
    label: "Training Ground",
    caption: "The Training Ground · raked gravel, bamboo, and a torii gate for Fitness & Discipline",
    requiresAnyGoal: ["fitness", "discipline"],
    lockedHint: "Unlocks when you pick Fitness or Discipline as a goal",
  },
  {
    id: "study",
    label: "Study Veranda",
    caption: "The Study Veranda · a quiet engawa for Business & Learning",
    requiresAnyGoal: ["business", "learning"],
    lockedHint: "Unlocks when you pick Business or Learning as a goal",
  },
  {
    id: "spring",
    label: "The Spring",
    caption: "The Spring · cherry blossoms over a warm onsen for Skin",
    requiresAnyGoal: ["skin"],
    lockedHint: "Unlocks when you pick Skin as a goal",
  },
] as const;

export function isZoneUnlocked(zone: ZoneMeta, goals: readonly GoalId[]): boolean {
  if (zone.requiresAnyGoal.length === 0) return true;
  return zone.requiresAnyGoal.some((g) => goals.includes(g));
}

export function zoneById(id: ZoneId): ZoneMeta {
  const found = ZONES.find((z) => z.id === id);
  if (!found) throw new Error(`Unknown zone id: ${id}`);
  return found;
}
