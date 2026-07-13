/**
 * Screen 1 — Welcome. Sets the emotional register; collects nothing.
 * Full ZenBackground (rendered by the flow root), wordmark, gold hairline,
 * tagline, title, neutral companion figure, BEGIN hero pill.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnboarding } from "../state/OnboardingContext";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { GoldButton } from "../ui/GoldButton";
import { gold, space, type } from "../ui/tokens";

export function WelcomeScreen() {
  const { dispatch } = useOnboarding();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.stack, { paddingTop: insets.top + 60 }]}>
        <Text style={type.wordmark}>KAIZI</Text>
        <View style={styles.divider} />
        <Text style={[type.tagline, styles.center]}>{"“Improve a little.\nWin a lot.”"}</Text>
        <Text style={[styles.title, styles.center]}>Build a life that builds you back</Text>
        <View style={styles.figure}>
          <CompanionAvatar species="neutral" size={94} />
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 48 }]}>
        <GoldButton
          label="BEGIN"
          variant="heroNeutral"
          onPress={() => dispatch({ kind: "next" })}
        />
        <Text style={[type.subSerif, styles.microcopy]}>
          Every promise shapes who you&apos;re becoming
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stack: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space.jumbo,
    paddingBottom: space.lg,
  },
  center: {
    textAlign: "center",
  },
  divider: {
    width: 40,
    height: StyleSheet.hairlineWidth,
    backgroundColor: gold.ink50,
    marginTop: 14,
    marginBottom: 18,
  },
  title: {
    ...type.heading,
    fontSize: 22,
    lineHeight: 29,
    marginTop: 28,
  },
  figure: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: space.xxxl,
  },
  microcopy: {
    textAlign: "center",
    marginTop: 16,
  },
});
