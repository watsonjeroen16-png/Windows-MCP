/**
 * Screen 5 — Personality Selection. Vertical stack of 5 PersonalityCards,
 * each previewing the companion's voice with the canonical sample line.
 * Background is ground.panel with no scenery — the cards are the scene.
 */
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

import { PERSONALITIES } from "../data/personalities";
import { useOnboarding } from "../state/OnboardingContext";
import { GoldButton } from "../ui/GoldButton";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { PersonalityCard } from "../ui/PersonalityCard";
import { space } from "../ui/tokens";

export function PersonalitySelectionScreen() {
  const { state, dispatch } = useOnboarding();

  return (
    <OnboardingScreen
      step={5}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      cta={
        <GoldButton
          label="CONTINUE"
          variant="quiet"
          disabled={state.personality === null}
          onPress={() => dispatch({ kind: "next" })}
        />
      }
    >
      <ScreenHeader
        eyebrow="THEIR VOICE"
        title="How should they speak to you?"
        subtitle="Hear each one. Choose the voice you'll listen to."
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.stack}
        showsVerticalScrollIndicator={false}
      >
        {PERSONALITIES.map((meta) => (
          <PersonalityCard
            key={meta.id}
            id={meta.id}
            selected={state.personality === meta.id}
            onPress={() => dispatch({ kind: "select_personality", personality: meta.id })}
          />
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
  stack: {
    gap: 10,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
});
