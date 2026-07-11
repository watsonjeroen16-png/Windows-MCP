import { describe, expect, it } from "vitest";

import {
  initialOnboardingState,
  isIdentityWhyValid,
  isValidE164,
  onboardingReducer,
  type OnboardingState,
} from "./OnboardingContext";

describe("isValidE164", () => {
  it.each([
    "+15551234567",
    "+31612345678",
    "+447911123456",
  ])("accepts %s", (phone) => {
    expect(isValidE164(phone)).toBe(true);
  });

  it.each([
    "5551234567", // missing +
    "+05551234567", // leading zero after +
    "+1555", // too short
    "+15551234567890123", // too long
    "+1 555 123 4567", // spaces
    "not-a-phone",
    "",
    "+१५५५१२३४५६७", // non-ASCII digits
  ])("rejects %j", (phone) => {
    expect(isValidE164(phone)).toBe(false);
  });
});

describe("isIdentityWhyValid", () => {
  it("rejects under 10 trimmed chars", () => {
    expect(isIdentityWhyValid("   short.   ")).toBe(false);
  });
  it("accepts exactly 10 trimmed chars", () => {
    expect(isIdentityWhyValid("  1234567890  ")).toBe(true);
  });
  it("accepts a real answer", () => {
    expect(isIdentityWhyValid("Because I'm tired of almost.")).toBe(true);
  });
  it("rejects over 280 chars", () => {
    expect(isIdentityWhyValid("x".repeat(281))).toBe(false);
  });
  it("accepts exactly 280 chars", () => {
    expect(isIdentityWhyValid("x".repeat(280))).toBe(true);
  });
});

describe("onboardingReducer", () => {
  it("toggle_goal adds then removes a goal", () => {
    let state = onboardingReducer(initialOnboardingState, { kind: "toggle_goal", goal: "fitness" });
    expect(state.goals).toEqual(["fitness"]);
    state = onboardingReducer(state, { kind: "toggle_goal", goal: "fitness" });
    expect(state.goals).toEqual([]);
  });

  it("set_identity_why hard-caps at 280 chars even if a caller passes more", () => {
    const state = onboardingReducer(initialOnboardingState, {
      kind: "set_identity_why",
      text: "x".repeat(500),
    });
    expect(state.identityWhy).toHaveLength(280);
  });

  it("set_phone resets phoneVerified and sessionToken (changing the phone invalidates any prior verification)", () => {
    const verified: OnboardingState = {
      ...initialOnboardingState,
      phone: "+15551234567",
      phoneVerified: true,
      sessionToken: "old-token",
    };
    const state = onboardingReducer(verified, { kind: "set_phone", phone: "+15557654321" });
    expect(state.phone).toBe("+15557654321");
    expect(state.phoneVerified).toBe(false);
    expect(state.sessionToken).toBeNull();
  });

  it("set_phone_verified sets phoneVerified and stores the session token", () => {
    const state = onboardingReducer(initialOnboardingState, {
      kind: "set_phone_verified",
      token: "abc.def",
    });
    expect(state.phoneVerified).toBe(true);
    expect(state.sessionToken).toBe("abc.def");
  });

  describe("step 7 sub-stage navigation (phone -> verify -> handoff, terminal)", () => {
    it("next() walks phone -> verify -> handoff and then holds (terminal screen)", () => {
      let state: OnboardingState = { ...initialOnboardingState, step: 7, smsStage: "phone" };
      state = onboardingReducer(state, { kind: "next" });
      expect(state.smsStage).toBe("verify");
      state = onboardingReducer(state, { kind: "next" });
      expect(state.smsStage).toBe("handoff");
      const terminal = onboardingReducer(state, { kind: "next" });
      expect(terminal).toEqual(state); // no further advance
    });

    it("back() from handoff is a no-op (no back from the terminal screen)", () => {
      const state: OnboardingState = { ...initialOnboardingState, step: 7, smsStage: "handoff" };
      const after = onboardingReducer(state, { kind: "back" });
      expect(after).toEqual(state);
    });

    it("back() from verify returns to phone", () => {
      const state: OnboardingState = { ...initialOnboardingState, step: 7, smsStage: "verify" };
      const after = onboardingReducer(state, { kind: "back" });
      expect(after.smsStage).toBe("phone");
    });
  });

  it("next()/back() at step boundaries never goes below 1 or above 7", () => {
    const atStart = onboardingReducer(initialOnboardingState, { kind: "back" });
    expect(atStart.step).toBe(1);

    let state: OnboardingState = initialOnboardingState;
    for (let i = 0; i < 6; i++) state = onboardingReducer(state, { kind: "next" });
    expect(state.step).toBe(7);
  });
});
