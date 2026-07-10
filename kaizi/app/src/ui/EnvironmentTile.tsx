/**
 * EnvironmentTile — 12 gradient worlds (spec screen 6). Each tile is a
 * 3-stop vertical SVG gradient plus exactly one animated accent layer,
 * a bottom scrim with the world name, and the gold selected ring.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { environmentById, type EnvironmentMotion } from "../data/environments";
import type { EnvironmentId } from "../data/ids";
import { MicroLabel } from "./MicroLabel";
import { useCycleValue, useLoopValue, useXpPop } from "./motion";
import { anim, gold, hue, line, radius, type } from "./tokens";

interface EnvironmentTileProps {
  id: EnvironmentId;
  selected: boolean;
  onPress: () => void;
  /** Animate the accent layer (parent limits concurrent loops to visible tiles). */
  animated?: boolean;
}

// ---------------------------------------------------------------------------
// Accent layers — one subtle motion per tile (spec table)
// ---------------------------------------------------------------------------

function GlowDot({
  color,
  size,
  left,
  top,
  delay,
  enabled,
}: {
  color: string;
  size: number;
  left: string;
  top: string;
  delay: number;
  enabled: boolean;
}) {
  const glow = useLoopValue(anim.lanternGlow, delay, enabled);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.5, 0.8]),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: left as `${number}%`,
          top: top as `${number}%`,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function FallingDot({
  color,
  left,
  duration,
  enabled,
}: {
  color: string;
  left: string;
  duration: number;
  enabled: boolean;
}) {
  const progress = useCycleValue(duration, 0, enabled);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.7, 0.5, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-4, 96]) },
      { translateX: interpolate(progress.value, [0, 1], [0, 10]) },
      { rotate: `${progress.value * 180}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: left as `${number}%`,
          top: 0,
          width: 5,
          height: 4,
          borderRadius: 2.5,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function RisingDot({
  left,
  delay,
  enabled,
}: {
  left: string;
  delay: number;
  enabled: boolean;
}) {
  const progress = useCycleValue(anim.particleRise, delay, enabled);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.4, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -40]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: left as `${number}%`,
          bottom: "20%",
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: gold.solid,
        },
        style,
      ]}
    />
  );
}

function FogBand({ enabled }: { enabled: boolean }) {
  const drift = useLoopValue(anim.fogDrift, 0, enabled);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-6, 6]) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fogBand, style]} />
  );
}

function RippleEllipse({ enabled }: { enabled: boolean }) {
  const ripple = useLoopValue(anim.waterRipple, 0, enabled);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.3, 0.1]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.15]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.rippleEllipse, style]} />;
}

function TrackPulse({ enabled }: { enabled: boolean }) {
  const pulse = useLoopValue(3000, 0, enabled);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.2, 0.4]),
  }));
  return <Animated.View pointerEvents="none" style={[styles.trackLine, style]} />;
}

function IslandSway({ enabled }: { enabled: boolean }) {
  const sway = useLoopValue(6000, 0, enabled);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sway.value, [0, 1], [-2, 2]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.island, style]} />;
}

function Accent({ motion, enabled }: { motion: EnvironmentMotion; enabled: boolean }) {
  switch (motion) {
    case "neon_dots":
      return (
        <>
          <GlowDot color="rgba(90,200,255,0.5)" size={5} left="28%" top="30%" delay={0} enabled={enabled} />
          <GlowDot color="rgba(255,90,180,0.4)" size={4} left="64%" top="48%" delay={900} enabled={enabled} />
        </>
      );
    case "warm_window":
      return (
        <GlowDot color={gold.glow8} size={12} left="58%" top="38%" delay={0} enabled={enabled} />
      );
    case "leaf_drift":
      return (
        <FallingDot color="rgba(140,190,120,0.4)" left="40%" duration={9000} enabled={enabled} />
      );
    case "fog_band":
      return <FogBand enabled={enabled} />;
    case "lantern_dot":
      return (
        <GlowDot color={gold.line25} size={7} left="46%" top="42%" delay={0} enabled={enabled} />
      );
    case "water_ripple":
      return <RippleEllipse enabled={enabled} />;
    case "gold_motes":
      return (
        <>
          <RisingDot left="32%" delay={0} enabled={enabled} />
          <RisingDot left="62%" delay={2000} enabled={enabled} />
        </>
      );
    case "star_dots":
      return (
        <>
          <GlowDot color="rgba(240,235,224,0.6)" size={1.5} left="24%" top="20%" delay={0} enabled={enabled} />
          <GlowDot color="rgba(240,235,224,0.6)" size={1.5} left="58%" top="34%" delay={1200} enabled={enabled} />
          <GlowDot color="rgba(240,235,224,0.6)" size={1.5} left="76%" top="16%" delay={2400} enabled={enabled} />
        </>
      );
    case "blossom_petal":
      return <FallingDot color={hue.blossom} left="44%" duration={10000} enabled={enabled} />;
    case "track_pulse":
      return <TrackPulse enabled={enabled} />;
    case "skyline_windows":
      return (
        <>
          <GlowDot color={gold.glow8} size={6} left="34%" top="44%" delay={0} enabled={enabled} />
          <GlowDot color={gold.glow8} size={6} left="60%" top="52%" delay={1500} enabled={enabled} />
        </>
      );
    case "island_sway":
      return <IslandSway enabled={enabled} />;
  }
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

export function EnvironmentTile({ id, selected, onPress, animated = true }: EnvironmentTileProps) {
  const meta = environmentById(id);
  const popStyle = useXpPop(selected);
  const gradientId = `env-${id}`;
  const scrimId = `scrim-${id}`;

  return (
    <Animated.View style={[styles.flexCell, popStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={meta.name}
        onPress={onPress}
        style={[styles.tile, selected ? styles.tileSelected : null]}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={meta.gradient[0]} />
              <Stop offset="0.5" stopColor={meta.gradient[1]} />
              <Stop offset="1" stopColor={meta.gradient[2]} />
            </LinearGradient>
            <LinearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
          <Rect x="0" y="60%" width="100%" height="40%" fill={`url(#${scrimId})`} />
        </Svg>
        <Accent motion={meta.motion} enabled={animated} />
        {selected ? <View style={styles.innerRing} pointerEvents="none" /> : null}
        {meta.recommended ? (
          <MicroLabel tone="gold" style={styles.beginHere}>
            BEGIN HERE
          </MicroLabel>
        ) : null}
        <Text
          style={[
            type.micro,
            styles.name,
            { color: selected ? gold.solid : "rgba(240,235,224,0.85)" },
          ]}
          numberOfLines={2}
        >
          {meta.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flexCell: {
    flex: 1,
  },
  tile: {
    aspectRatio: 1 / 1.25,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  tileSelected: {
    borderColor: gold.line40,
    borderWidth: 1,
  },
  innerRing: {
    ...StyleSheet.absoluteFillObject,
    margin: 2,
    borderRadius: radius.lg - 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gold.line20,
  },
  name: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    lineHeight: 12,
  },
  beginHere: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    textAlign: "center",
    width: "100%",
  },
  fogBand: {
    position: "absolute",
    top: "46%",
    left: "-10%",
    right: "-10%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(240,235,224,0.07)",
  },
  rippleEllipse: {
    position: "absolute",
    bottom: "22%",
    alignSelf: "center",
    width: 44,
    height: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(240,235,224,0.6)",
  },
  trackLine: {
    position: "absolute",
    top: "58%",
    left: "12%",
    right: "12%",
    height: 1,
    backgroundColor: "#F0EBE0",
  },
  island: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    width: 34,
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(10,15,28,0.85)",
  },
});
