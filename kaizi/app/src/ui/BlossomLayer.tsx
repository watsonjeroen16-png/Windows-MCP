/**
 * Shared falling-petal particle system (blossom-fall, tokens.md section 5):
 * translateY(-10 -> 820), translateX(0 -> 60), rotate(0 -> 180deg),
 * opacity 0 -> 0.7 (10%) -> 0.5 (90%) -> 0, over 8-18s with staggered delays.
 */
import React from "react";
import { StyleSheet } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";

import { useCycleValue } from "./motion";
import { blossomVariants, hue } from "./tokens";

interface PetalSpec {
  left: number; // % across the screen
  size: number;
  color: string;
  duration: number;
  delay: number;
}

interface BlossomLayerProps {
  count: number;
  /** Override colors (e.g. green leaf drift); defaults to blossom pinks. */
  palette?: readonly string[];
  /** Fall distance in px; defaults to the design canvas height (820). */
  fallHeight?: number;
}

const DEFAULT_PALETTE: readonly string[] = [hue.blossom, ...blossomVariants];

/** Deterministic petal specs — spec calls for delays 0/1/2/4s, 8-13s falls. */
const BASE_SPECS: ReadonlyArray<Omit<PetalSpec, "color">> = [
  { left: 18, size: 7, duration: 9000, delay: 0 },
  { left: 62, size: 6, duration: 11000, delay: 1000 },
  { left: 80, size: 5, duration: 13000, delay: 2000 },
  { left: 38, size: 6, duration: 10000, delay: 4000 },
  { left: 50, size: 5, duration: 12000, delay: 3000 },
  { left: 8, size: 6, duration: 14000, delay: 5000 },
];

function Petal({ spec, fallHeight }: { spec: PetalSpec; fallHeight: number }) {
  const progress = useCycleValue(spec.duration, spec.delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.7, 0.5, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-10, fallHeight]) },
      { translateX: interpolate(progress.value, [0, 1], [0, 60]) },
      { rotate: `${progress.value * 180}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.petal,
        {
          left: `${spec.left}%`,
          width: spec.size,
          height: spec.size * 0.8,
          borderRadius: spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

export function BlossomLayer({
  count,
  palette = DEFAULT_PALETTE,
  fallHeight = 820,
}: BlossomLayerProps) {
  const specs: PetalSpec[] = BASE_SPECS.slice(0, Math.min(count, BASE_SPECS.length)).map(
    (base, index) => ({ ...base, color: palette[index % palette.length] as string }),
  );
  return (
    <>
      {specs.map((spec, index) => (
        <Petal key={index} spec={spec} fallHeight={fallHeight} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  petal: {
    position: "absolute",
    top: 0,
  },
});
