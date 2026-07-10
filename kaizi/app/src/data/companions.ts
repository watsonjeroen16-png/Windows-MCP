import type { CompanionId } from "./ids";

export interface CompanionMeta {
  id: CompanionId;
  /** Display name (also used as the companion's name until naming ships). */
  name: string;
  /** One-word trait label, uppercase micro under the name. */
  trait: string;
}

/** Order matches the spec's table (screen 4). */
export const COMPANIONS: readonly CompanionMeta[] = [
  { id: "wolf_pup", name: "Wolf Pup", trait: "LOYAL" },
  { id: "fox", name: "Fox", trait: "CLEVER" },
  { id: "lion", name: "Lion", trait: "BOLD" },
  { id: "dog", name: "Dog", trait: "STEADY" },
  { id: "human_male", name: "Human", trait: "GROUNDED" },
  { id: "human_female", name: "Human", trait: "GRACEFUL" },
  { id: "dragonkin", name: "Dragonkin", trait: "FIERCE" },
] as const;

export function companionById(id: CompanionId): CompanionMeta {
  const found = COMPANIONS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown companion id: ${id}`);
  return found;
}
