/**
 * Three gold dots pulsing lantern-glow at staggered delays (0/0.4/0.8s) —
 * the quiet "listening" indicator on the handoff screen, reused as the
 * inline verifying spinner on 7b.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";

import { useLoopValue } from "./motion";
import { anim, gold } from "./tokens";

function PulseDot({ delay }: { delay: number }) {
  const glow = useLoopValue(anim.lanternGlow, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.5, 0.8]),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function ListeningDots() {
  return (
    <View style={styles.row} accessibilityLabel="Listening">
      <PulseDot delay={0} />
      <PulseDot delay={400} />
      <PulseDot delay={800} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: gold.solid,
  },
});
