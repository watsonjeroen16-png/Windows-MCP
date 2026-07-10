/**
 * Screen 4 — Companion Selection. Scrollable 2-column grid of glass cards,
 * each with an animated SVG companion, name, and one-word trait. Selected
 * card gets the gold ring + gold name + one xp-pop. Off-screen idle loops
 * are kept cheap by the small fixed set (7 cards).
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { COMPANIONS, type CompanionMeta } from "../data/companions";
import { useOnboarding } from "../state/OnboardingContext";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { GoldButton } from "../ui/GoldButton";
import { MicroLabel } from "../ui/MicroLabel";
import { useXpPop } from "../ui/motion";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { font, gold, hue, line, mist, radius, space } from "../ui/tokens";

function CompanionCard({
  meta,
  selected,
  onPress,
}: {
  meta: CompanionMeta;
  selected: boolean;
  onPress: () => void;
}) {
  const popStyle = useXpPop(selected);
  return (
    <Animated.View style={[styles.cell, popStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${meta.name}, ${meta.trait.toLowerCase()}`}
        onPress={onPress}
        style={[styles.card, selected ? styles.cardSelected : null]}
      >
        <View style={styles.avatarSlot}>
          <CompanionAvatar species={meta.id} size={104} />
        </View>
        <Text style={[styles.name, { color: selected ? gold.solid : hue.cream }]}>
          {meta.name}
        </Text>
        <MicroLabel style={styles.trait}>{meta.trait}</MicroLabel>
      </Pressable>
    </Animated.View>
  );
}

export function CompanionSelectionScreen() {
  const { state, dispatch } = useOnboarding();

  return (
    <OnboardingScreen
      step={4}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      cta={
        <GoldButton
          label="CONTINUE"
          variant="quiet"
          disabled={state.companion === null}
          onPress={() => dispatch({ kind: "next" })}
        />
      }
    >
      <ScreenHeader
        eyebrow="YOUR COMPANION"
        title="Who walks with you?"
        subtitle="They'll grow as you do."
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {COMPANIONS.map((meta) => (
          <CompanionCard
            key={meta.id}
            meta={meta}
            selected={state.companion === meta.id}
            onPress={() => dispatch({ kind: "select_companion", companion: meta.id })}
          />
        ))}
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginTop: space.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  cell: {
    width: "48%",
    flexGrow: 1,
  },
  card: {
    backgroundColor: mist[7],
    borderColor: line[14],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: 14,
    alignItems: "center",
    aspectRatio: 3 / 4,
    justifyContent: "center",
  },
  cardSelected: {
    borderColor: gold.line40,
    backgroundColor: gold.fill10,
  },
  avatarSlot: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontFamily: font.serifLight,
    fontSize: 16,
    lineHeight: 21,
    marginTop: 6,
  },
  trait: {
    marginTop: 4,
  },
});
