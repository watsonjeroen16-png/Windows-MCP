/**
 * Screen 6 — Environment Selection. 3-column x 4-row grid of gradient
 * EnvironmentTiles, one motion accent each. Japanese Garden carries the
 * BEGIN HERE micro-label as the recommended default; nothing pre-selected.
 * Concurrent loops stay bounded (12 tiles x 1 accent, most single-element).
 */
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ENVIRONMENTS } from "../data/environments";
import { useOnboarding } from "../state/OnboardingContext";
import { EnvironmentTile } from "../ui/EnvironmentTile";
import { GoldButton } from "../ui/GoldButton";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { space } from "../ui/tokens";

export function EnvironmentSelectionScreen() {
  const { state, dispatch } = useOnboarding();

  const rows: (typeof ENVIRONMENTS)[number][][] = [];
  for (let i = 0; i < ENVIRONMENTS.length; i += 3) {
    rows.push(ENVIRONMENTS.slice(i, i + 3));
  }

  return (
    <OnboardingScreen
      step={7}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      cta={
        <GoldButton
          label="CONTINUE"
          variant="quiet"
          disabled={state.environment === null}
          onPress={() => dispatch({ kind: "next" })}
        />
      }
    >
      <ScreenHeader
        eyebrow="YOUR WORLD"
        title="Choose your world"
        subtitle="Where your companion lives — and where you'll meet."
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((meta) => (
              <EnvironmentTile
                key={meta.id}
                id={meta.id}
                selected={state.environment === meta.id}
                onPress={() => dispatch({ kind: "select_environment", environment: meta.id })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginTop: space.md,
  },
  grid: {
    gap: 10,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
});
