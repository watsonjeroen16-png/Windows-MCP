/**
 * Quiz secondary progress indicator — personalization-spec.md section 1.2:
 * "a slim horizontal bar or '3 of 10' counter... distinct from the global
 * ProgressDots so ten questions don't visually inflate the whole
 * onboarding's perceived length."
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { anim, gold, line, radius, text, type } from "./tokens";

interface QuizProgressProps {
  /** 1-based current card. */
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  const progress = useSharedValue(current / total);
  useEffect(() => {
    progress.value = withTiming(current / total, {
      duration: anim.micro,
      easing: Easing.out(Easing.ease),
    });
  }, [current, total, progress]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      <Text style={[type.meta, styles.counter]}>
        {current} of {total}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  counter: {
    color: text.faint,
    marginBottom: 8,
  },
  track: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: line[8],
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: gold.ink60,
  },
});
