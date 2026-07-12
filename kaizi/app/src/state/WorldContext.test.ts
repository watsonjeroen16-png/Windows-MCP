import { describe, expect, it } from "vitest";

import { createInitialWorldState, worldReducer } from "./WorldContext";

function baseState() {
  return createInitialWorldState({
    sessionToken: "token-123",
    goals: ["fitness"],
    companion: "fox",
    personality: "coach",
    environment: "japanese_garden",
  });
}

describe("worldReducer", () => {
  it("starts on the World screen with no sheet open", () => {
    const state = baseState();
    expect(state.screen).toBe("world");
    expect(state.sheet).toBe("none");
    expect(state.zone).toBe("courtyard");
  });

  it("navigate switches between World and You", () => {
    const state = worldReducer(baseState(), { kind: "navigate", screen: "you" });
    expect(state.screen).toBe("you");
  });

  it("open_sheet/close_sheet toggle the active contextual sheet", () => {
    let state = worldReducer(baseState(), { kind: "open_sheet", sheet: "intentions" });
    expect(state.sheet).toBe("intentions");
    state = worldReducer(state, { kind: "close_sheet" });
    expect(state.sheet).toBe("none");
  });

  it("set_you_tab switches the You screen's segmented tab", () => {
    const state = worldReducer(baseState(), { kind: "set_you_tab", tab: "companion" });
    expect(state.youTab).toBe("companion");
  });

  it("select_zone changes the active zone (gating is the caller's responsibility, per data/zones.ts)", () => {
    const state = worldReducer(baseState(), { kind: "select_zone", zone: "training" });
    expect(state.zone).toBe("training");
  });

  it("cycle_weather rotates clear -> rain -> mist -> clear", () => {
    let state = baseState();
    expect(state.weather).toBe("clear");
    state = worldReducer(state, { kind: "cycle_weather" });
    expect(state.weather).toBe("rain");
    state = worldReducer(state, { kind: "cycle_weather" });
    expect(state.weather).toBe("mist");
    state = worldReducer(state, { kind: "cycle_weather" });
    expect(state.weather).toBe("clear");
  });

  it("set_customization overrides the onboarding-time companion/personality/environment and marks it loaded", () => {
    const state = worldReducer(baseState(), {
      kind: "set_customization",
      companion: "dragonkin",
      personality: "rival",
      environment: "sky_islands",
    });
    expect(state.companion).toBe("dragonkin");
    expect(state.personality).toBe("rival");
    expect(state.environment).toBe("sky_islands");
    expect(state.customizationLoaded).toBe(true);
  });

  it("bump_intentions increments intentionsVersion (cache-invalidation signal for the pouch/sheet)", () => {
    const state = worldReducer(baseState(), { kind: "bump_intentions" });
    expect(state.intentionsVersion).toBe(1);
  });

  it("identity (session token, goals) is immutable across every action", () => {
    const state = worldReducer(baseState(), { kind: "navigate", screen: "you" });
    expect(state.identity).toEqual({ sessionToken: "token-123", goals: ["fitness"] });
  });
});
