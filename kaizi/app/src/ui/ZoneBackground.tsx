/**
 * Per-zone World backgrounds (app-restructure-v3.md section 4.1). Same
 * continuous garden (shared sky, shared ground plane) but each zone gets its
 * own distinct planting/structures — translated from the mockup's SVG art
 * direction into RN primitives + react-native-svg, not a re-tint of the
 * Courtyard:
 *   - Courtyard: koi pond, sand garden, stone lanterns (existing zen-garden art)
 *   - Training Ground: torii gate, raked gravel, warm-toned bamboo
 *   - Study Veranda: ink-wash mountains, a lone pine, engawa/shoji lines
 *   - The Spring: cherry blossom trees, a warm onsen pool
 *
 * Also carries the weather-cycle affordance's visual layer (clear/rain/mist)
 * — ephemeral, independent of time-of-day, per world-spec.md section 4.3.
 */
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Ellipse, Line, Path, Rect } from "react-native-svg";

import type { ZoneId } from "../data/zones";
import { BlossomLayer } from "./BlossomLayer";
import { useLoopValue } from "./motion";
import type { Weather } from "../state/WorldContext";
import { anim, ground } from "./tokens";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface ZoneBackgroundProps {
  zone: ZoneId;
  weather: Weather;
  /** Dimmed, non-interactive preview treatment for a locked zone. */
  locked?: boolean;
}

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

function RippleRing({ size, delay, color }: { size: number; delay: number; color: string }) {
  const ripple = useLoopValue(anim.waterRipple, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.35, 0.1]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.15]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size * 0.34, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
}

function GroundHill({
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
// Zone scenes
// ---------------------------------------------------------------------------

function CourtyardScene() {
  return (
    <>
      <GroundHill color="#0F1A12" width={SCREEN_W * 1.5} height={220} bottom={-40} left={-SCREEN_W * 0.25} />
      {/* Sand garden */}
      <View style={[styles.sandGarden, { left: SCREEN_W * 0.1 }]} />
      {/* Koi pond */}
      <View style={[styles.pond, { right: SCREEN_W * 0.08 }]}>
        <RippleRing size={110} delay={0} color="rgba(190,215,220,0.25)" />
        <RippleRing size={72} delay={600} color="rgba(190,215,220,0.2)" />
      </View>
      {/* Stone lanterns */}
      <View style={[styles.lantern, { left: SCREEN_W * 0.16, bottom: 130 }]} />
      <View style={[styles.lantern, { right: SCREEN_W * 0.14, bottom: 100 }]} />
      <BlossomLayer count={3} fallHeight={SCREEN_H + 20} />
    </>
  );
}

function TrainingGroundScene() {
  return (
    <>
      <GroundHill color="#1C1712" width={SCREEN_W * 1.5} height={220} bottom={-40} left={-SCREEN_W * 0.25} />
      {/* Torii gate */}
      <Svg
        width={140}
        height={140}
        viewBox="0 0 140 140"
        style={[styles.absolute, { left: SCREEN_W * 0.08, bottom: 110 }]}
      >
        <Rect x={18} y={30} width={9} height={100} fill="#3B1B14" />
        <Rect x={113} y={30} width={9} height={100} fill="#3B1B14" />
        <Path d="M4 34 Q70 8 136 34 L136 46 Q70 22 4 46 Z" fill="#4A2418" />
        <Rect x={12} y={54} width={116} height={11} rx={2} fill="#3A1E12" />
      </Svg>
      {/* Raked gravel */}
      <View style={[styles.gravel, { right: SCREEN_W * 0.1 }]}>
        <Svg width={130} height={60} viewBox="0 0 130 60">
          <Path d="M8 14 Q65 4 122 14" stroke="rgba(255,235,200,0.12)" strokeWidth={1} fill="none" />
          <Path d="M6 28 Q65 18 124 28" stroke="rgba(255,235,200,0.12)" strokeWidth={1} fill="none" />
          <Path d="M8 42 Q65 32 122 42" stroke="rgba(255,235,200,0.12)" strokeWidth={1} fill="none" />
        </Svg>
      </View>
      {/* Warm-toned bamboo */}
      <BambooStalk left={SCREEN_W - 30} height={SCREEN_H * 0.34} delay={200} color="#4C4420" />
      <BambooStalk left={SCREEN_W - 52} height={SCREEN_H * 0.26} delay={600} color="#3A3418" />
      <BambooStalk left={SCREEN_W - 70} height={SCREEN_H * 0.3} delay={1000} color="#463F1D" />
    </>
  );
}

function StudyVerandaScene() {
  return (
    <>
      <GroundHill color="#1A2028" width={SCREEN_W * 1.5} height={200} bottom={-30} left={-SCREEN_W * 0.25} />
      {/* Ink-wash mountains, far to near */}
      <Svg width={SCREEN_W} height={160} viewBox={`0 0 ${SCREEN_W} 160`} style={[styles.absolute, { bottom: 160 }]}>
        <Path
          d={`M-20 100 Q${SCREEN_W * 0.2} 40 ${SCREEN_W * 0.4} 96 Q${SCREEN_W * 0.55} 60 ${SCREEN_W * 0.7} 100 Q${SCREEN_W * 0.85} 50 ${SCREEN_W + 20} 100 L${SCREEN_W + 20} 160 L-20 160 Z`}
          fill="#232C36"
          opacity={0.55}
        />
        <Path
          d={`M10 120 Q${SCREEN_W * 0.28} 76 ${SCREEN_W * 0.5} 116 Q${SCREEN_W * 0.7} 80 ${SCREEN_W - 10} 118 L${SCREEN_W - 10} 160 L10 160 Z`}
          fill="#2C3844"
          opacity={0.45}
        />
      </Svg>
      {/* Lone pine */}
      <Svg
        width={80}
        height={110}
        viewBox="0 0 80 110"
        style={[styles.absolute, { left: SCREEN_W * 0.14, bottom: 96 }]}
      >
        <Rect x={36} y={40} width={5} height={68} fill="#1C1712" />
        <Ellipse cx={40} cy={30} rx={26} ry={13} fill="#26301F" />
        <Ellipse cx={28} cy={22} rx={18} ry={10} fill="#2C3824" />
        <Ellipse cx={52} cy={24} rx={16} ry={9} fill="#26301F" />
      </Svg>
      {/* Engawa / shoji lines near the ground */}
      <View style={[styles.engawa, { right: SCREEN_W * 0.06 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.shojiLine} />
        ))}
      </View>
    </>
  );
}

function SpringScene() {
  return (
    <>
      <GroundHill color="#26161C" width={SCREEN_W * 1.5} height={210} bottom={-40} left={-SCREEN_W * 0.25} />
      {/* Cherry blossom trees */}
      <Svg
        width={150}
        height={150}
        viewBox="0 0 150 150"
        style={[styles.absolute, { left: SCREEN_W * 0.05, bottom: 120 }]}
      >
        <Path d="M64 148 L72 90 Q75 76 88 66 L93 73 Q83 84 81 98 L86 148 Z" fill="#4A342A" />
        <Ellipse cx={86} cy={68} rx={58} ry={38} fill="#E7A9C0" opacity={0.9} />
        <Ellipse cx={50} cy={90} rx={36} ry={24} fill="#E1A0BA" opacity={0.85} />
        <Ellipse cx={120} cy={86} rx={40} ry={26} fill="#EAB4C8" opacity={0.85} />
        <Ellipse cx={88} cy={46} rx={34} ry={21} fill="#F0C2D4" opacity={0.8} />
      </Svg>
      <Svg
        width={110}
        height={140}
        viewBox="0 0 110 140"
        style={[styles.absolute, { right: SCREEN_W * 0.02, bottom: 150 }]}
      >
        <Path d="M52 138 L58 96 Q60 86 70 79 L73 84 Q67 91 66 100 L70 138 Z" fill="#4A342A" />
        <Ellipse cx={66} cy={78} rx={38} ry={25} fill="#EAB4C8" opacity={0.85} />
        <Ellipse cx={46} cy={92} rx={24} ry={16} fill="#E1A0BA" opacity={0.8} />
      </Svg>
      {/* Onsen pool */}
      <View style={[styles.onsen]}>
        <RippleRing size={130} delay={0} color="rgba(255,190,150,0.22)" />
        <RippleRing size={86} delay={700} color="rgba(255,190,150,0.18)" />
      </View>
      <BlossomLayer count={4} fallHeight={SCREEN_H + 20} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Weather overlay (clear / rain / mist) — ephemeral, independent of zone
// ---------------------------------------------------------------------------

function RainLayer() {
  const fall = useLoopValue(1400, 0);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(fall.value, [0, 1], [0.18, 0.32]),
  }));
  const drops = Array.from({ length: 18 }, (_, i) => i);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`}>
        {drops.map((i) => {
          const x = (i * 977) % SCREEN_W;
          const y = (i * 613) % SCREEN_H;
          return (
            <Line
              key={i}
              x1={x}
              y1={y}
              x2={x - 6}
              y2={y + 22}
              stroke="rgba(200,220,235,0.35)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

function MistLayer() {
  const drift = useLoopValue(anim.fogDrift);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-SCREEN_W * 0.05, SCREEN_W * 0.05]) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.mistBand, style]} />
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const ZONE_GROUND: Record<ZoneId, string> = {
  courtyard: ground.gardenNight,
  training: "#160F0A",
  study: "#0C1016",
  spring: "#160B10",
};

export function ZoneBackground({ zone, weather, locked = false }: ZoneBackgroundProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: ZONE_GROUND[zone] },
        locked ? styles.lockedDim : null,
      ]}
    >
      {zone === "courtyard" ? <CourtyardScene /> : null}
      {zone === "training" ? <TrainingGroundScene /> : null}
      {zone === "study" ? <StudyVerandaScene /> : null}
      {zone === "spring" ? <SpringScene /> : null}
      {weather === "rain" ? <RainLayer /> : null}
      {weather === "mist" ? <MistLayer /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: "absolute",
  },
  bamboo: {
    position: "absolute",
    bottom: 90,
    width: 6,
    borderRadius: 3,
  },
  ripple: {
    position: "absolute",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  pond: {
    position: "absolute",
    bottom: 150,
    width: 150,
    height: 60,
    borderRadius: 40,
    backgroundColor: "#0A0E0A",
    alignItems: "center",
    justifyContent: "center",
  },
  sandGarden: {
    position: "absolute",
    bottom: 140,
    width: 130,
    height: 50,
    borderRadius: 36,
    backgroundColor: "#161310",
  },
  lantern: {
    position: "absolute",
    width: 14,
    height: 26,
    borderRadius: 3,
    backgroundColor: "#2A1A08",
  },
  gravel: {
    position: "absolute",
    bottom: 140,
    width: 130,
    height: 60,
  },
  engawa: {
    position: "absolute",
    bottom: 60,
    width: 140,
    gap: 6,
  },
  shojiLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(230,220,200,0.1)",
  },
  onsen: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    width: 150,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  mistBand: {
    position: "absolute",
    left: -SCREEN_W * 0.1,
    right: -SCREEN_W * 0.1,
    top: SCREEN_H * 0.42,
    height: 90,
    backgroundColor: "rgba(220,225,230,0.06)",
  },
  lockedDim: {
    opacity: 0.55,
  },
});
