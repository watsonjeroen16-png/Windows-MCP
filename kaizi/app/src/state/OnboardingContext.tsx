/**
 * Onboarding state — context + reducer implementing the OnboardingState shape
 * from onboarding-spec.md (ids in snake_case per the backend contract; see
 * src/data/ids.ts for the deviation note).
 *
 * Navigation is a state-driven step switcher, not a router: the flow is 8
 * strictly linear steps (step 4 is the personalization quiz — a 10-card
 * internal sequence tracked by `quizIndex`, plus two sub-screens inside step
 * 8), so `step` + `quizIndex` + `smsStage` fully determine what renders.
 * expo-router would add file-system routing, deep links, and a nav container
 * none of which this build needs.
 *
 * Persistence: state lives in memory for this build. The spec's "killing the
 * app resumes at the last incomplete step" needs AsyncStorage, which is not
 * in the approved dependency list; the reducer is already serializable, so
 * wiring @react-native-async-storage/async-storage later is a small follow-up.
 */
import React, { createContext, useContext, useMemo, useReducer } from "react";

import type { CompanionId, EnvironmentId, GoalId, PersonalityId } from "../data/ids";
import { QUIZ_LENGTH, type QuizQuestionKey } from "../data/quiz";
import type { SlideDirection } from "../ui/motion";

// Step 4 (Quiz) was inserted after Why per personalization-spec.md section 1
// (approved 2026-07-12) — Companion/Personality/Environment/SMS all shift by
// one. Screen-time consent (spec section 2) is cut by founder decision and
// has no step here: onboarding goes 7 -> 8, not 9.
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Sub-screens of step 8 (8a phone, 8b verify, 8c terminal handoff). */
export type SmsStage = "phone" | "verify" | "handoff";

export interface SmsPrefs {
  morning: boolean;
  evening: boolean;
}

/**
 * Quiz answers, keyed exactly as `quizAnswersSchema` (kaizi/server/src/schemas.ts)
 * expects for `POST /api/onboarding/quiz` — single-select values are the
 * option's canonical string; `availability` is the one multi-select (string[]).
 * Skipped/unanswered questions are simply absent, never null (spec section 1.5).
 */
export type QuizAnswers = Partial<Record<QuizQuestionKey, string | string[]>>;

export interface OnboardingState {
  goals: GoalId[]; // >= 1 to continue past step 2
  identityWhy: string; // trimmed 10-280 chars to continue past step 3
  /** 0-based index into QUIZ_QUESTIONS — internal sub-progress of step 4. */
  quizIndex: number;
  quizAnswers: QuizAnswers;
  /** True only if "Skip quiz" was tapped on the first card. */
  quizSkipped: boolean;
  companion: CompanionId | null;
  personality: PersonalityId | null;
  environment: EnvironmentId | null;
  phone: string | null; // E.164, e.g. "+31612345678"
  phoneVerified: boolean;
  /**
   * Bearer session token issued by verify/check on success (server:
   * kaizi/server/README.md). Required by submitProfile/sendWelcomeSms —
   * the server derives the phone from this token, not from any phone field
   * in those requests (docs/security-review.md H-2). Null until verified.
   */
  sessionToken: string | null;
  smsPrefs: SmsPrefs; // both default true
  step: Step; // resume point
  smsStage: SmsStage;
  /** Direction of the last navigation — drives the card-slide-in mirror. */
  direction: SlideDirection;
}

export const initialOnboardingState: OnboardingState = {
  goals: [],
  identityWhy: "",
  quizIndex: 0,
  quizAnswers: {},
  quizSkipped: false,
  companion: null,
  personality: null,
  environment: null,
  phone: null,
  phoneVerified: false,
  sessionToken: null,
  smsPrefs: { morning: true, evening: true },
  step: 1,
  smsStage: "phone",
  direction: "forward",
};

export type OnboardingAction =
  | { kind: "toggle_goal"; goal: GoalId }
  | { kind: "set_identity_why"; text: string }
  | { kind: "set_quiz_answer"; key: QuizQuestionKey; value: string }
  | { kind: "toggle_quiz_multi_answer"; key: QuizQuestionKey; value: string }
  | { kind: "skip_whole_quiz" }
  | { kind: "select_companion"; companion: CompanionId }
  | { kind: "select_personality"; personality: PersonalityId }
  | { kind: "select_environment"; environment: EnvironmentId }
  | { kind: "set_phone"; phone: string }
  | { kind: "set_phone_verified"; token: string }
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
    case "set_quiz_answer":
      return {
        ...state,
        quizAnswers: { ...state.quizAnswers, [action.key]: action.value },
      };
    case "toggle_quiz_multi_answer": {
      const current = state.quizAnswers[action.key];
      const arr = Array.isArray(current) ? current : [];
      const has = arr.includes(action.value);
      const next = has ? arr.filter((v) => v !== action.value) : [...arr, action.value];
      return { ...state, quizAnswers: { ...state.quizAnswers, [action.key]: next } };
    }
    case "skip_whole_quiz":
      return { ...state, quizSkipped: true, quizIndex: 0, step: 5, direction: "forward" };
    case "select_companion":
      return { ...state, companion: action.companion };
    case "select_personality":
      return { ...state, personality: action.personality };
    case "select_environment":
      return { ...state, environment: action.environment };
    case "set_phone":
      return { ...state, phone: action.phone, phoneVerified: false, sessionToken: null };
    case "set_phone_verified":
      return { ...state, phoneVerified: true, sessionToken: action.token };
    case "set_sms_pref":
      return { ...state, smsPrefs: { ...state.smsPrefs, [action.pref]: action.value } };
    case "next": {
      // Inside step 4 (Quiz): "next" advances the internal card index rather
      // than the global step — used by single-select auto-advance, the
      // multi-select (Q5) Continue CTA, and "Skip this question" alike. On
      // the 10th card it completes the quiz and moves to step 5 (Companion).
      if (state.step === 4) {
        const advanced = state.quizIndex + 1;
        if (advanced >= QUIZ_LENGTH) {
          return { ...state, quizIndex: 0, step: 5, direction: "forward" };
        }
        return { ...state, quizIndex: advanced, direction: "forward" };
      }
      if (state.step < 8) {
        return { ...state, step: (state.step + 1) as Step, direction: "forward" };
      }
      // Inside step 8: phone -> verify -> handoff (terminal).
      if (state.smsStage === "phone") return { ...state, smsStage: "verify", direction: "forward" };
      if (state.smsStage === "verify") {
        return { ...state, smsStage: "handoff", direction: "forward" };
      }
      return state; // handoff is terminal — the app rests here
    }
    case "back": {
      if (state.step === 8) {
        if (state.smsStage === "handoff") return state; // no back from terminal screen
        if (state.smsStage === "verify") {
          return { ...state, smsStage: "phone", direction: "back" };
        }
      }
      // Inside step 4 (Quiz): back steps to the previous card; from the
      // first card it exits the whole quiz step back to Why (step 3).
      if (state.step === 4 && state.quizIndex > 0) {
        return { ...state, quizIndex: state.quizIndex - 1, direction: "back" };
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
