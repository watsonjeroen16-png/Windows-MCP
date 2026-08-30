/**
 * Pure Tamagotchi game logic: no React, no storage, no clocks of its own.
 * Every function takes an explicit timestamp so state can be replayed after
 * the app was closed for hours or days.
 */

export interface PetStats {
  /** 100 = just ate, 0 = starving. */
  fullness: number;
  /** 100 = wide awake, 0 = exhausted. */
  energy: number;
  /** 100 = delighted, 0 = miserable. */
  happiness: number;
  /** 100 = squeaky clean, 0 = filthy. */
  hygiene: number;
}

export type Stage = "baby" | "kid" | "adult";

export type Mood = "ecstatic" | "happy" | "okay" | "grumpy" | "sick" | "asleep";

export interface PetState {
  name: string;
  /** file:// URI of the scanned face photo, or null before the first scan. */
  faceUri: string | null;
  stats: PetStats;
  /** Epoch ms when the pet was born (first face scan). */
  bornAt: number;
  /** Epoch ms when stats were last recomputed. */
  updatedAt: number;
  /** Total care actions performed; drives leveling. */
  careScore: number;
  sleeping: boolean;
}

export type Action = "feed" | "play" | "sleep" | "wake" | "wash";

/** Stat points lost per hour while awake. */
const DECAY_PER_HOUR: PetStats = {
  fullness: 8,
  energy: 5,
  happiness: 6,
  hygiene: 4,
};

/** While sleeping, energy regenerates and everything else decays slower. */
const SLEEP_ENERGY_GAIN_PER_HOUR = 25;
const SLEEP_DECAY_FACTOR = 0.4;

const HOUR_MS = 3_600_000;

export const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function newPet(name: string, faceUri: string | null, now: number): PetState {
  return {
    name,
    faceUri,
    stats: { fullness: 80, energy: 90, happiness: 70, hygiene: 100 },
    bornAt: now,
    updatedAt: now,
    careScore: 0,
    sleeping: false,
  };
}

/** Recompute stats for the time elapsed since the last update. */
export function tick(pet: PetState, now: number): PetState {
  const hours = Math.max(0, now - pet.updatedAt) / HOUR_MS;
  if (hours === 0) return pet;

  const factor = pet.sleeping ? SLEEP_DECAY_FACTOR : 1;
  const stats: PetStats = {
    fullness: clamp(pet.stats.fullness - DECAY_PER_HOUR.fullness * factor * hours),
    energy: pet.sleeping
      ? clamp(pet.stats.energy + SLEEP_ENERGY_GAIN_PER_HOUR * hours)
      : clamp(pet.stats.energy - DECAY_PER_HOUR.energy * hours),
    happiness: clamp(pet.stats.happiness - DECAY_PER_HOUR.happiness * factor * hours),
    hygiene: clamp(pet.stats.hygiene - DECAY_PER_HOUR.hygiene * factor * hours),
  };

  // A fully rested pet wakes up on its own.
  const sleeping = pet.sleeping && stats.energy < 100;
  return { ...pet, stats, sleeping, updatedAt: now };
}

export function applyAction(pet: PetState, action: Action, now: number): PetState {
  const current = tick(pet, now);
  const { stats } = current;

  switch (action) {
    case "feed":
      if (current.sleeping) return current;
      return bumpCare(current, {
        ...stats,
        fullness: clamp(stats.fullness + 30),
        hygiene: clamp(stats.hygiene - 5),
      });
    case "play":
      if (current.sleeping || stats.energy < 15) return current;
      return bumpCare(current, {
        ...stats,
        happiness: clamp(stats.happiness + 25),
        energy: clamp(stats.energy - 15),
        fullness: clamp(stats.fullness - 10),
      });
    case "wash":
      if (current.sleeping) return current;
      return bumpCare(current, { ...stats, hygiene: 100 });
    case "sleep":
      return { ...current, sleeping: true };
    case "wake":
      return { ...current, sleeping: false };
  }
}

function bumpCare(pet: PetState, stats: PetStats): PetState {
  return { ...pet, stats, careScore: pet.careScore + 1 };
}

export function mood(pet: PetState): Mood {
  if (pet.sleeping) return "asleep";
  const values = Object.values(pet.stats);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (min < 15) return "sick";
  if (min < 30) return "grumpy";
  if (avg >= 90) return "ecstatic";
  if (avg >= 60) return "happy";
  return "okay";
}

export function stage(pet: PetState, now: number): Stage {
  const ageHours = (now - pet.bornAt) / HOUR_MS;
  if (ageHours < 24) return "baby";
  if (ageHours < 72) return "kid";
  return "adult";
}

export function level(pet: PetState): number {
  return 1 + Math.floor(pet.careScore / 10);
}

export const MOOD_EMOJI: Record<Mood, string> = {
  ecstatic: "🤩",
  happy: "😊",
  okay: "😐",
  grumpy: "😾",
  sick: "🤒",
  asleep: "💤",
};
