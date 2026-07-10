/**
 * Shared motion primitives implementing the animation vocabulary in
 * tokens.md section 5 (quiet motion: slow, small-amplitude, ease-in-out
 * ambience; fast easing only for user-triggered transitions).
 *
 * All ambient loops respect the OS Reduce Motion setting: they freeze at
 * their midpoint (0.5) while user-triggered transitions stay enabled.
 */
import { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { anim } from "./tokens";

/**
 * Oscillating loop 0 -> 1 -> 0 (withRepeat reversed). The workhorse for
 * bamboo-sway, water-ripple, lantern-glow, idle-sway, fog-drift.
 */
export function useLoopValue(duration: number, delay = 0, enabled = true): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled || reduced) {
      value.value = 0.5; // freeze at midpoint
      return;
    }
    value.value = 0;
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(value);
  }, [duration, delay, enabled, reduced, value]);
  return value;
}

/**
 * One-way cycling loop 0 -> 1, snap back, repeat (not reversed). Used for
 * blossom-fall and particle-rise where the element re-enters from the start.
 */
export function useCycleValue(duration: number, delay = 0, enabled = true): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled || reduced) {
      value.value = 0.35; // freeze mid-fall
      return;
    }
    value.value = 0;
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(value);
  }, [duration, delay, enabled, reduced, value]);
  return value;
}

/**
 * xp-pop (tokens.md): scale 0.7 -> 1.1 at 60% -> 1, ~350ms ease-out overshoot.
 * Fires each time `active` flips from false to true.
 */
export function useXpPop(active: boolean) {
  const scale = useSharedValue(1);
  const prev = useRef(active);
  useEffect(() => {
    if (active && !prev.current) {
      scale.value = 0.7;
      scale.value = withSequence(
        withTiming(1.1, { duration: anim.xpPop * 0.6, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: anim.xpPop * 0.4, easing: Easing.out(Easing.ease) }),
      );
    }
    prev.current = active;
  }, [active, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** Imperative xp-pop trigger (for pops not tied to a boolean prop). */
export function usePopTrigger(): { style: ReturnType<typeof useAnimatedStyle>; pop: () => void } {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pop = () => {
    scale.value = 0.7;
    scale.value = withSequence(
      withTiming(1.1, { duration: anim.xpPop * 0.6, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: anim.xpPop * 0.4, easing: Easing.out(Easing.ease) }),
    );
  };
  return { style, pop };
}

/**
 * Error shake: translateX +/-6px, 3 cycles, ~300ms (spec 7b). Fires whenever
 * `nonce` increments past 0.
 */
export function useShake(nonce: number) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (nonce > 0) {
      x.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [nonce, x]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

export type SlideDirection = "forward" | "back";

interface SlideInProps {
  direction: SlideDirection;
  style?: ViewStyle;
  children: React.ReactNode;
}

/**
 * card-slide-in (380ms ease-out): translateX(100%) + rotate(4deg) + opacity 0
 * -> identity. Mirrored from the left when navigating back. Wrap each step's
 * foreground content; the ZenBackground behind it never re-animates.
 */
export function SlideIn({ direction, style, children }: SlideInProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const sign = direction === "back" ? -1 : 1;
  const width = Dimensions.get("window").width;
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: anim.cardSlideIn,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: (1 - progress.value) * sign * width },
      { rotate: `${(1 - progress.value) * sign * 4}deg` },
    ],
  }));
  return <Animated.View style={[styles.fill, style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/** Convenience: absolute-fill style reused by scenery layers. */
export const absoluteFill = StyleSheet.absoluteFillObject;

/** Plain positioned dot — building block for glow/particle accents. */
export function Dot({ size, color, style }: { size: number; color: string; style?: ViewStyle }) {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
