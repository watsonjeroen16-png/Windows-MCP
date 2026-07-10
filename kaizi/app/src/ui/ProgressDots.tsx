/**
 * Step indicator — 7 dots, 5px, gap 8. Current: gold.icon90 5x14 pill;
 * completed: gold.ink50; upcoming: line.14. Width/color animate 250ms
 * ease-out on step change.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { anim, gold, line } from "./tokens";

interface ProgressDotsProps {
  total?: number;
  /** 1-based current step. */
  current: number;
}

type DotStatus = "completed" | "current" | "upcoming";

function Dot({ status }: { status: DotStatus }) {
  // 0 = upcoming, 1 = completed, 2 = current
  const progress = useSharedValue(status === "current" ? 2 : status === "completed" ? 1 : 0);

  useEffect(() => {
    const target = status === "current" ? 2 : status === "completed" ? 1 : 0;
    progress.value = withTiming(target, {
      duration: anim.micro,
      easing: Easing.out(Easing.ease),
    });
  }, [status, progress]);

  const style = useAnimatedStyle(() => ({
    width: 5 + Math.max(0, progress.value - 1) * 9, // 5 -> 14 only for current
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1, 2],
      [line[14], gold.ink50, gold.icon90],
    ),
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export function ProgressDots({ total = 7, current }: ProgressDotsProps) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const status: DotStatus =
          step === current ? "current" : step < current ? "completed" : "upcoming";
        return <Dot key={step} status={status} />;
      })}
    </View>
  );
}

/** All-complete variant for the terminal handoff screen (all gold.ink50). */
export function ProgressDotsComplete({ total = 7 }: { total?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, { width: 5, backgroundColor: gold.ink50 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 5,
    borderRadius: 999,
  },
});
