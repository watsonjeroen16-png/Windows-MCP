/**
 * Post-onboarding app root — mounts once the handoff screen's beat completes
 * (App.tsx). Two destinations only, no persistent tab bar
 * (app-restructure-v3.md section 3): World is the app's only home; You is a
 * deliberate side trip reached via the World screen's avatar chip.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import type { CompanionId, EnvironmentId, GoalId, PersonalityId } from "../data/ids";
import { ground } from "../ui/tokens";
import { useWorld, WorldProvider } from "../state/WorldContext";
import { WorldScreen } from "./WorldScreen";
import { YouScreen } from "./YouScreen";

export interface KaiziAppProps {
  sessionToken: string;
  goals: GoalId[];
  companion: CompanionId;
  personality: PersonalityId;
  environment: EnvironmentId;
}

function KaiziAppScreens() {
  const { state } = useWorld();
  return (
    <View style={styles.root}>
      {state.screen === "world" ? <WorldScreen /> : <YouScreen />}
    </View>
  );
}

export function KaiziApp({ sessionToken, goals, companion, personality, environment }: KaiziAppProps) {
  return (
    <WorldProvider
      sessionToken={sessionToken}
      goals={goals}
      companion={companion}
      personality={personality}
      environment={environment}
    >
      <KaiziAppScreens />
    </WorldProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ground.base,
  },
});
