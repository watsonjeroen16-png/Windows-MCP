/**
 * Post-onboarding app state — the World/You restructure (app-restructure-v3.md).
 * Two destinations (World, You), contextual sheets (Chat/Intentions/Reflection)
 * that overlay World rather than replacing it, and a zone travel strip.
 *
 * Identity (session token, onboarding goals) is fixed at handoff and never
 * changes here. Companion appearance/personality/environment are mutable
 * post-onboarding (world-build-plan.md's customization endpoint) — this
 * context fetches the live customization on mount and falls back to the
 * onboarding-chosen values until that resolves, matching the server's own
 * fallback rule in GET /api/customization.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";

import { getCustomization } from "../api/client";
import type { CompanionId, EnvironmentId, GoalId, PersonalityId } from "../data/ids";
import type { ZoneId } from "../data/zones";

export type WorldScreenId = "world" | "you";
export type SheetId = "none" | "chat" | "intentions" | "reflection";
export type YouTab = "progress" | "companion" | "settings";
export type Weather = "clear" | "rain" | "mist";

export interface WorldIdentity {
  sessionToken: string;
  goals: GoalId[];
}

export interface WorldState {
  identity: WorldIdentity;
  screen: WorldScreenId;
  sheet: SheetId;
  youTab: YouTab;
  zone: ZoneId;
  weather: Weather;
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
  customizationLoaded: boolean;
  /** Bumped whenever an intention is kept/created, so the pouch/sheet can refetch without a shared cache layer. */
  intentionsVersion: number;
}

export type WorldAction =
  | { kind: "navigate"; screen: WorldScreenId }
  | { kind: "open_sheet"; sheet: Exclude<SheetId, "none"> }
  | { kind: "close_sheet" }
  | { kind: "set_you_tab"; tab: YouTab }
  | { kind: "select_zone"; zone: ZoneId }
  | { kind: "cycle_weather" }
  | {
      kind: "set_customization";
      companion: CompanionId;
      personality: PersonalityId;
      environment: EnvironmentId;
    }
  | { kind: "bump_intentions" };

const WEATHER_CYCLE: readonly Weather[] = ["clear", "rain", "mist"];

/** Exported for testability, mirroring OnboardingContext's onboardingReducer. */
export function worldReducer(state: WorldState, action: WorldAction): WorldState {
  switch (action.kind) {
    case "navigate":
      return { ...state, screen: action.screen };
    case "open_sheet":
      return { ...state, sheet: action.sheet };
    case "close_sheet":
      return { ...state, sheet: "none" };
    case "set_you_tab":
      return { ...state, youTab: action.tab };
    case "select_zone":
      return { ...state, zone: action.zone };
    case "cycle_weather": {
      const idx = WEATHER_CYCLE.indexOf(state.weather);
      return { ...state, weather: WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length]! };
    }
    case "set_customization":
      return {
        ...state,
        companion: action.companion,
        personality: action.personality,
        environment: action.environment,
        customizationLoaded: true,
      };
    case "bump_intentions":
      return { ...state, intentionsVersion: state.intentionsVersion + 1 };
  }
}

interface WorldContextValue {
  state: WorldState;
  dispatch: React.Dispatch<WorldAction>;
}

const WorldContext = createContext<WorldContextValue | null>(null);

export interface WorldProviderProps {
  sessionToken: string;
  goals: GoalId[];
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
  children: React.ReactNode;
}

/** Exported for testability, mirroring OnboardingContext's initialOnboardingState builder. */
export function createInitialWorldState(props: {
  sessionToken: string;
  goals: GoalId[];
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
}): WorldState {
  return {
    identity: { sessionToken: props.sessionToken, goals: props.goals },
    screen: "world",
    sheet: "none",
    youTab: "progress",
    zone: "courtyard",
    weather: "clear",
    companion: props.companion,
    personality: props.personality,
    environment: props.environment,
    customizationLoaded: false,
    intentionsVersion: 0,
  };
}

export function WorldProvider({
  sessionToken,
  goals,
  companion,
  personality,
  environment,
  children,
}: WorldProviderProps) {
  const [state, dispatch] = useReducer(
    worldReducer,
    createInitialWorldState({ sessionToken, goals, companion, personality, environment })
  );

  // Live customization overrides the onboarding-time choice, matching the
  // server's own "customization, falling back to onboarding profile" rule.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getCustomization(sessionToken);
      if (cancelled || result === null) return;
      dispatch({
        kind: "set_customization",
        companion: result.customization.companion_species,
        personality: result.customization.personality,
        environment: result.customization.environment,
      });
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per session — sessionToken is stable for the lifetime of WorldProvider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld(): WorldContextValue {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error("useWorld must be used inside <WorldProvider>");
  return ctx;
}
