import { describe, expect, it } from "vitest";

import { applyAction, level, mood, newPet, stage, tick } from "../src/state/petLogic";

const HOUR = 3_600_000;
const T0 = 1_000_000_000_000;

describe("petLogic", () => {
  it("creates a pet with sane starting stats", () => {
    const pet = newPet("Tama", "file:///face.jpg", T0);
    expect(pet.stats.fullness).toBe(80);
    expect(pet.sleeping).toBe(false);
    expect(mood(pet)).toBe("happy");
  });

  it("decays stats over elapsed time and clamps at zero", () => {
    const pet = newPet("Tama", null, T0);
    const later = tick(pet, T0 + 2 * HOUR);
    expect(later.stats.fullness).toBeCloseTo(80 - 16);
    expect(later.stats.energy).toBeCloseTo(90 - 10);

    const muchLater = tick(pet, T0 + 1000 * HOUR);
    expect(muchLater.stats.fullness).toBe(0);
    expect(muchLater.stats.hygiene).toBe(0);
  });

  it("never decays backwards if the clock is behind updatedAt", () => {
    const pet = newPet("Tama", null, T0);
    expect(tick(pet, T0 - HOUR).stats).toEqual(pet.stats);
  });

  it("feeding restores fullness and clamps at 100", () => {
    const pet = newPet("Tama", null, T0);
    const fed = applyAction(pet, "feed", T0);
    expect(fed.stats.fullness).toBe(100);
    expect(fed.careScore).toBe(1);
  });

  it("playing costs energy and is refused when exhausted", () => {
    let pet = newPet("Tama", null, T0);
    pet = { ...pet, stats: { ...pet.stats, energy: 10 } };
    const after = applyAction(pet, "play", T0);
    expect(after.stats.happiness).toBe(pet.stats.happiness);
    expect(after.careScore).toBe(0);
  });

  it("sleeping regenerates energy and wakes automatically at full", () => {
    let pet = newPet("Tama", null, T0);
    pet = { ...pet, stats: { ...pet.stats, energy: 20 } };
    pet = applyAction(pet, "sleep", T0);
    expect(pet.sleeping).toBe(true);
    expect(mood(pet)).toBe("asleep");

    const rested = tick(pet, T0 + 4 * HOUR);
    expect(rested.stats.energy).toBeGreaterThan(20);
    const fullyRested = tick(pet, T0 + 10 * HOUR);
    expect(fullyRested.stats.energy).toBe(100);
    expect(fullyRested.sleeping).toBe(false);
  });

  it("refuses care actions while asleep", () => {
    const pet = applyAction(newPet("Tama", null, T0), "sleep", T0);
    const fed = applyAction(pet, "feed", T0);
    expect(fed.stats.fullness).toBe(pet.stats.fullness);
  });

  it("reports sick mood when any stat is critical", () => {
    let pet = newPet("Tama", null, T0);
    pet = { ...pet, stats: { ...pet.stats, hygiene: 5 } };
    expect(mood(pet)).toBe("sick");
  });

  it("advances life stages with age", () => {
    const pet = newPet("Tama", null, T0);
    expect(stage(pet, T0)).toBe("baby");
    expect(stage(pet, T0 + 30 * HOUR)).toBe("kid");
    expect(stage(pet, T0 + 100 * HOUR)).toBe("adult");
  });

  it("levels up every 10 care actions", () => {
    let pet = newPet("Tama", null, T0);
    expect(level(pet)).toBe(1);
    for (let i = 0; i < 10; i++) pet = applyAction(pet, "feed", T0);
    expect(level(pet)).toBe(2);
  });
});
