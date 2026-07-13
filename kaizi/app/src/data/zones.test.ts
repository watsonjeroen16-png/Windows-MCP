import { describe, expect, it } from "vitest";

import { isZoneUnlocked, ZONES, zoneById } from "./zones";

describe("zones", () => {
  it("has the 4 zones from app-restructure-v3.md section 4.1", () => {
    expect(ZONES.map((z) => z.id)).toEqual(["courtyard", "training", "study", "spring"]);
  });

  it("the Courtyard is always unlocked regardless of goals", () => {
    expect(isZoneUnlocked(zoneById("courtyard"), [])).toBe(true);
  });

  it("Training Ground unlocks on Fitness or Discipline", () => {
    const training = zoneById("training");
    expect(isZoneUnlocked(training, [])).toBe(false);
    expect(isZoneUnlocked(training, ["fitness"])).toBe(true);
    expect(isZoneUnlocked(training, ["discipline"])).toBe(true);
    expect(isZoneUnlocked(training, ["skin"])).toBe(false);
  });

  it("Study Veranda unlocks on Business or Learning", () => {
    const study = zoneById("study");
    expect(isZoneUnlocked(study, ["business"])).toBe(true);
    expect(isZoneUnlocked(study, ["learning"])).toBe(true);
    expect(isZoneUnlocked(study, ["fitness"])).toBe(false);
  });

  it("The Spring unlocks on Skin only", () => {
    const spring = zoneById("spring");
    expect(isZoneUnlocked(spring, ["skin"])).toBe(true);
    expect(isZoneUnlocked(spring, ["business"])).toBe(false);
  });

  it("zoneById throws on an unknown id", () => {
    // @ts-expect-error deliberately invalid id for the runtime-guard test
    expect(() => zoneById("nowhere")).toThrow();
  });
});
