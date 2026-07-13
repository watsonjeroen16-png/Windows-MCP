/**
 * Screen 2 — Goal Selection. Multi-select chips, min 1 to continue.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { GOAL_IDS, GOAL_LABELS } from "../data/ids";
import { useOnboarding } from "../state/OnboardingContext";
import { Chip } from "../ui/Chip";
import { GoldButton } from "../ui/GoldButton";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { gold, space, type } from "../ui/tokens";

export function GoalSelectionScreen() {
  const { state, dispatch } = useOnboarding();
  const count = state.goals.length;

  return (
    <OnboardingScreen
      step={2}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      cta={
        <GoldButton
          label="CONTINUE"
          variant="quiet"
          disabled={count === 0}
          onPress={() => dispatch({ kind: "next" })}
        />
      }
      microcopy="You can add more goals later"
    >
      <ScreenHeader
        eyebrow="FIRST PROMISE"
        title="What are you building?"
        subtitle="Choose everything that matters to you."
      />
      <View style={styles.chipField}>
        <View style={styles.chipRow}>
          {GOAL_IDS.map((goal) => (
            <Chip
              key={goal}
              label={GOAL_LABELS[goal]}
              selected={state.goals.includes(goal)}
              onPress={() => dispatch({ kind: "toggle_goal", goal })}
            />
          ))}
        </View>
        <View style={styles.hintSlot}>
          {count >= 1 ? (
            <Text style={[type.meta, { color: gold.ink60 }]}>{count} selected</Text>
          ) : null}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  chipField: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  hintSlot: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
