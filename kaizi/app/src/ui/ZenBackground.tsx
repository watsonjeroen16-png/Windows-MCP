/**
 * Ambient zen scenery — built entirely from positioned Views (ellipse pills,
 * stalk rects, concentric glow circles) so ambience animates cheaply on the
 * UI thread. Variants:
 *   - welcome: full scene (hills, bamboo, garden bed, pond, glow orb, petals)
 *   - ambient: single dim hill at 40% + 2 petals (screens 2, 4)
 *   - night:   2 slow petals only (screen 3)
 * The background persists across steps and never re-animates on navigation —
 * only foreground content transitions (spec, global chrome).
 */
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";

import { BlossomLayer } from "./BlossomLayer";
import { useLoopValue } from "./motion";
import { anim, gold, ground, misc, scenery } from "./tokens";

export type ZenVariant = "welcome" | "ambient" | "night";

interface ZenBackgroundProps {
  variant: ZenVariant;
  /** Optional sky tint override (handoff screen: chosen environment color). */
  skyTint?: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Bamboo stalk: thin rounded rect, bamboo-sway rotation from its base. */
function BambooStalk({
  left,
  height,
  delay,
  color,
}: {
  left: number;
  height: number;
  delay: number;
  color: string;
}) {
  const sway = useLoopValue(anim.bambooSway, delay);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(sway.value, [0, 1], [-0.75, 0.75])}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bamboo,
        { left, height, backgroundColor: color, transformOrigin: "50% 100%" },
        style,
      ]}
    />
  );
}

/** Pond ripple ring: scale 1 -> 1.15, opacity 0.3 -> 0.1 (water-ripple). */
function RippleRing({ size, delay }: { size: number; delay: number }) {
  const ripple = useLoopValue(anim.waterRipple, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.3, 0.1]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.15]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size * 0.32, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

/** Gold glow orb: 3 concentric circles with a slow lantern-glow pulse. */
export function GlowOrb({
  size = 180,
  style: containerStyle,
}: {
  size?: number;
  style?: object;
}) {
  const glow = useLoopValue(anim.lanternGlow);
  const pulse = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.5, 0.8]),
  }));
  const ring = (scale: number, color: string) => ({
    position: "absolute" as const,
    width: size * scale,
    height: size * scale,
    borderRadius: (size * scale) / 2,
    backgroundColor: color,
    top: (size * (1 - scale)) / 2,
    left: (size * (1 - scale)) / 2,
  });
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, containerStyle, pulse]}>
      <View style={ring(1, gold.glow4)} />
      <View style={ring(0.72, gold.glow5)} />
      <View style={ring(0.46, gold.glow6)} />
    </Animated.View>
  );
}

/** Wide pill used as a soft hill/garden-bed silhouette. */
function Hill({
  color,
  width,
  height,
  bottom,
  left,
  opacity = 1,
}: {
  color: string;
  width: number;
  height: number;
  bottom: number;
  left: number;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width,
        height,
        bottom,
        left,
        opacity,
        borderRadius: height / 2,
        backgroundColor: color,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

function WelcomeScene() {
  return (
    <>
      {/* Upper sky band */}
      <View style={[styles.skyBand, { backgroundColor: ground.warm }]} />
      {/* Hills */}
      <Hill color={scenery.welcomeHillA} width={SCREEN_W * 1.6} height={280} bottom={90} left={-SCREEN_W * 0.5} />
      <Hill color={scenery.welcomeHillB} width={SCREEN_W * 1.4} height={220} bottom={40} left={SCREEN_W * 0.1} />
      {/* Bamboo — 5 stalks left + right, staggered 0.3-1.1s */}
      <BambooStalk left={14} height={SCREEN_H * 0.42} delay={300} color={scenery.bambooWelcome} />
      <BambooStalk left={34} height={SCREEN_H * 0.34} delay={700} color={scenery.bambooWelcome} />
      <BambooStalk left={52} height={SCREEN_H * 0.28} delay={1100} color={scenery.bambooWelcome} />
      <BambooStalk left={SCREEN_W - 30} height={SCREEN_H * 0.4} delay={500} color={scenery.bambooWelcome} />
      <BambooStalk left={SCREEN_W - 52} height={SCREEN_H * 0.3} delay={900} color={scenery.bambooWelcome} />
      {/* Garden bed */}
      <Hill color={scenery.gardenBedA} width={SCREEN_W * 1.3} height={150} bottom={-30} left={-SCREEN_W * 0.15} />
      <Hill color={scenery.gardenBedB} width={SCREEN_W * 1.1} height={110} bottom={-40} left={SCREEN_W * 0.05} />
      {/* Foreground hill */}
      <Hill color={ground.deep} width={SCREEN_W * 1.5} height={120} bottom={-60} left={-SCREEN_W * 0.25} />
      {/* Pond with two ripple rings (3s, 0.5s offset) */}
      <View style={styles.pond}>
        <RippleRing size={110} delay={0} />
        <RippleRing size={70} delay={500} />
      </View>
      {/* Gold glow orb upper-right */}
      <GlowOrb size={190} style={styles.orb} />
      {/* 4 blossom particles */}
      <BlossomLayer count={4} fallHeight={SCREEN_H + 20} />
    </>
  );
}

function AmbientScene() {
  return (
    <>
      <Hill
        color={scenery.welcomeHillA}
        width={SCREEN_W * 1.5}
        height={200}
        bottom={-80}
        left={-SCREEN_W * 0.25}
        opacity={0.4}
      />
      <BlossomLayer count={2} fallHeight={SCREEN_H + 20} />
    </>
  );
}

function NightScene() {
  return <BlossomLayer count={2} fallHeight={SCREEN_H + 20} />;
}

const VARIANT_GROUND: Record<ZenVariant, string> = {
  welcome: ground.deep,
  ambient: ground.base,
  night: ground.night,
};

export function ZenBackground({ variant, skyTint }: ZenBackgroundProps) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: VARIANT_GROUND[variant] }]}
    >
      {skyTint !== undefined ? (
        <View style={[styles.skyBand, { backgroundColor: skyTint, opacity: 0.5 }]} />
      ) : null}
      {variant === "welcome" ? <WelcomeScene /> : null}
      {variant === "ambient" ? <AmbientScene /> : null}
      {variant === "night" ? <NightScene /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skyBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.35,
  },
  bamboo: {
    position: "absolute",
    bottom: 60,
    width: 7,
    borderRadius: 4,
  },
  pond: {
    position: "absolute",
    bottom: 26,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 130,
    height: 44,
  },
  ripple: {
    position: "absolute",
    borderWidth: 1,
    borderColor: misc.white,
    backgroundColor: "transparent",
  },
  orb: {
    position: "absolute",
    top: SCREEN_H * 0.06,
    right: -30,
  },
});
