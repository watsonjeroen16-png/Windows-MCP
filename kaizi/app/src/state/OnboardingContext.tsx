/**
 * Onboarding state — context + reducer implementing the OnboardingState shape
 * from onboarding-spec.md (ids in snake_case per the backend contract; see
 * src/data/ids.ts for the deviation note).
 *
 * Navigation is a state-driven step switcher, not a router: the flow is 7
 * strictly linear screens (plus two sub-screens inside step 7), so `step` +
 * `smsStage` fully determine what renders. expo-router would add file-system
 * routing, deep links, and a nav container none of which this build needs.
 *
 * Persistence: state lives in memory for this build. The spec's "killing the
 * app resumes at the last incomplete step" needs AsyncStorage, which is not
 * in the approved dependency list; the reducer is already serializable, so
 * wiring @react-native-async-storage/async-storage later is a small follow-up.
 */
import React, { createContext, useContext, useMemo, useReducer } from "react";

import type { CompanionId, EnvironmentId, GoalId, PersonalityId } from "../data/ids";
import type { SlideDirection } from "../ui/motion";

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Sub-screens of step 7 (7a phone, 7b verify, 7c terminal handoff). */
export type SmsStage = "phone" | "verify" | "handoff";

export interface SmsPrefs {
  morning: boolean;
  evening: boolean;
}

export interface OnboardingState {
  goals: GoalId[]; // >= 1 to continue past step 2
  identityWhy: string; // trimmed 10-280 chars to continue past step 3
  companion: CompanionId | null;
  personality: PersonalityId | null;
  environment: EnvironmentId | null;
  phone: string | null; // E.164, e.g. "+31612345678"
  phoneVerified: boolean;
  smsPrefs: SmsPrefs; // both default true
  step: Step; // resume point
  smsStage: SmsStage;
  /** Direction of the last navigation — drives the card-slide-in mirror. */
  direction: SlideDirection;
}

export const initialOnboardingState: OnboardingState = {
  goals: [],
  identityWhy: "",
  companion: null,
  personality: null,
  environment: null,
  phone: null,
  phoneVerified: false,
  smsPrefs: { morning: true, evening: true },
  step: 1,
  smsStage: "phone",
  direction: "forward",
};

export type OnboardingAction =
  | { kind: "toggle_goal"; goal: GoalId }
  | { kind: "set_identity_why"; text: string }
  | { kind: "select_companion"; companion: CompanionId }
  | { kind: "select_personality"; personality: PersonalityId }
  | { kind: "select_environment"; environment: EnvironmentId }
  | { kind: "set_phone"; phone: string }
  | { kind: "set_phone_verified" }
  | { kind: "set_sms_pref"; pref: keyof SmsPrefs; value: boolean }
  | { kind: "next" }
  | { kind: "back" };

const MAX_WHY_LENGTH = 280;

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.kind) {
    case "toggle_goal": {
      const has = state.goals.includes(action.goal);
      return {
        ...state,
        goals: has ? state.goals.filter((g) => g !== action.goal) : [...state.goals, action.goal],
      };
    }
    case "set_identity_why":
      return { ...state, identityWhy: action.text.slice(0, MAX_WHY_LENGTH) };
    case "select_companion":
      return { ...state, companion: action.companion };
    case "select_personality":
      return { ...state, personality: action.personality };
    case "select_environment":
      return { ...state, environment: action.environment };
    case "set_phone":
      return { ...state, phone: action.phone, phoneVerified: false };
    case "set_phone_verified":
      return { ...state, phoneVerified: true };
    case "set_sms_pref":
      return { ...state, smsPrefs: { ...state.smsPrefs, [action.pref]: action.value } };
    case "next": {
      if (state.step < 7) {
        return { ...state, step: (state.step + 1) as Step, direction: "forward" };
      }
      // Inside step 7: phone -> verify -> handoff (terminal).
      if (state.smsStage === "phone") return { ...state, smsStage: "verify", direction: "forward" };
      if (state.smsStage === "verify") {
        return { ...state, smsStage: "handoff", direction: "forward" };
      }
      return state; // handoff is terminal — the app rests here
    }
    case "back": {
      if (state.step === 7) {
        if (state.smsStage === "handoff") return state; // no back from terminal screen
        if (state.smsStage === "verify") {
          return { ...state, smsStage: "phone", direction: "back" };
        }
      }
      if (state.step > 1) {
        return { ...state, step: (state.step - 1) as Step, direction: "back" };
      }
      return state;
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers (single source for screen gating)
// ---------------------------------------------------------------------------

export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_PATTERN.test(phone);
}

export function isIdentityWhyValid(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 10 && trimmed.length <= MAX_WHY_LENGTH;
}

export { MAX_WHY_LENGTH };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface OnboardingContextValue {
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
