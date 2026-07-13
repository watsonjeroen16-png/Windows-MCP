import type { EnvironmentId } from "./ids";

/** The one animated accent each tile carries (spec screen 6 table). */
export type EnvironmentMotion =
  | "neon_dots"
  | "warm_window"
  | "leaf_drift"
  | "fog_band"
  | "lantern_dot"
  | "water_ripple"
  | "gold_motes"
  | "star_dots"
  | "blossom_petal"
  | "track_pulse"
  | "skyline_windows"
  | "island_sway";

export interface EnvironmentMeta {
  id: EnvironmentId;
  name: string;
  /** 3-stop vertical gradient, top -> bottom (values verbatim from spec). */
  gradient: readonly [string, string, string];
  motion: EnvironmentMotion;
  /** Japanese Garden carries the "BEGIN HERE" micro-label. */
  recommended?: boolean;
}

/** Order matches the spec's 3x4 grid table. */
export const ENVIRONMENTS: readonly EnvironmentMeta[] = [
  {
    id: "cyber_city",
    name: "Cyber City",
    gradient: ["#0A0E1A", "#16204A", "#2A1A4A"],
    motion: "neon_dots",
  },
  {
    id: "modern_apartment",
    name: "Modern Apartment",
    gradient: ["#141210", "#241E16", "#3A2E1E"],
    motion: "warm_window",
  },
  {
    id: "forest_village",
    name: "Forest Village",
    gradient: ["#0A140C", "#14261A", "#1E3820"],
    motion: "leaf_drift",
  },
  {
    id: "mountain_retreat",
    name: "Mountain Retreat",
    gradient: ["#0C1016", "#1A2430", "#2E3A46"],
    motion: "fog_band",
  },
  {
    id: "dojo",
    name: "Dojo",
    gradient: ["#160F0A", "#2A1A10", "#3A2416"],
    motion: "lantern_dot",
  },
  {
    id: "coastal_paradise",
    name: "Coastal Paradise",
    gradient: ["#081420", "#0E2A3A", "#1A4A50"],
    motion: "water_ripple",
  },
  {
    id: "fantasy_kingdom",
    name: "Fantasy Kingdom",
    gradient: ["#100A1E", "#241440", "#3A2060"],
    motion: "gold_motes",
  },
  {
    id: "space_colony",
    name: "Space Colony",
    gradient: ["#05060C", "#0C1024", "#1A1A3A"],
    motion: "star_dots",
  },
  {
    id: "japanese_garden",
    name: "Japanese Garden",
    gradient: ["#090C0A", "#0F1A12", "#14261A"],
    motion: "blossom_petal",
    recommended: true,
  },
  {
    id: "training_campus",
    name: "Training Campus",
    gradient: ["#0C0E10", "#1C2226", "#2E3A34"],
    motion: "track_pulse",
  },
  {
    id: "entrepreneur_district",
    name: "Entrepreneur District",
    gradient: ["#0E0C08", "#201A10", "#36281A"],
    motion: "skyline_windows",
  },
  {
    id: "sky_islands",
    name: "Sky Islands",
    gradient: ["#0A0F1C", "#16283E", "#2A4A5E"],
    motion: "island_sway",
  },
] as const;

export function environmentById(id: EnvironmentId): EnvironmentMeta {
  const found = ENVIRONMENTS.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown environment id: ${id}`);
  return found;
}
