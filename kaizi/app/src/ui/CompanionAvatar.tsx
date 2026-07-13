/**
 * CompanionAvatar — the 7 companion species as SVG primitive compositions
 * (spec screen 4 table; no licensed assets), plus a "neutral" human-figure
 * silhouette for the Welcome screen.
 *
 * Motion layers:
 *  - whole-figure idle-sway (translateY 0 -> -2px, 4s) on every species;
 *  - one secondary per-species loop (tail wag, wing flex, mane sway, ...)
 *    rendered as an overlay SVG behind the base so tails/wings/hair sit
 *    behind the body. Humans breathe via a subtle scaleY on the base itself.
 * The spec lists occasional tertiary twitches (ear flick, blink); those are
 * omitted to keep concurrent loops battery-friendly — noted as a deviation.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from "react-native-svg";

import type { CompanionId } from "../data/ids";
import { useCycleValue, useLoopValue } from "./motion";
import { anim, gold, hue, misc } from "./tokens";

export type AvatarSpecies = CompanionId | "neutral";

interface CompanionAvatarProps {
  species: AvatarSpecies;
  /** Rendered width in px; height follows the 120x140 design canvas. */
  size?: number;
  animated?: boolean;
}

const VIEWBOX_W = 120;
const VIEWBOX_H = 140;

type MotionKind = "rotate" | "translateX" | "scaleY";

interface SecondaryMotion {
  kind: MotionKind;
  /** Degrees for rotate, px for translateX, scale delta for scaleY. */
  amount: number;
  duration: number;
  /** CSS-style transformOrigin for the overlay. */
  origin: string;
}

interface SpeciesArt {
  /** Parts that sit behind the body and carry the secondary motion. */
  overlay?: { node: React.ReactNode; motion: SecondaryMotion };
  /** Static base figure. */
  base: React.ReactNode;
  /** Breathing applied to the base itself (humans). */
  baseMotion?: SecondaryMotion;
  /** Extra ember particles (dragonkin). */
  embers?: boolean;
}

// ---------------------------------------------------------------------------
// Palette constants from the spec table
// ---------------------------------------------------------------------------

const WOLF_BODY = "#3A4048";
const WOLF_MUZZLE = "#C8CCD2";
const FOX_BODY = "#B8622E";
const FOX_WHITE = "rgba(240,235,224,0.9)";
const LION_BODY = "#C99C46";
const LION_MANE_DARK = "#8A5A20";
const LION_MANE_LIGHT = "#D4A853";
const DOG_BODY = "#8A6844";
const DOG_EAR = "#6F5335";
const DOG_TONGUE = "rgba(230,150,150,0.8)";
const DRAGON_BODY = "#2A5A55";
const DRAGON_WING = "rgba(42,90,85,0.6)";
const FEMALE_ROBE = "#3A2A35";
const FEMALE_ROBE_DEEP = "#2A1E28";

const groundShadow = (
  <Ellipse cx={60} cy={128} rx={34} ry={8} fill={misc.shadowFigure} key="shadow" />
);

function eyes(y: number, xLeft: number, xRight: number): React.ReactNode {
  return (
    <>
      <Circle cx={xLeft} cy={y} r={3} fill={misc.eyeInk} />
      <Circle cx={xRight} cy={y} r={3} fill={misc.eyeInk} />
      <Circle cx={xLeft + 1} cy={y - 1} r={1} fill={misc.white} />
      <Circle cx={xRight + 1} cy={y - 1} r={1} fill={misc.white} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Species compositions
// ---------------------------------------------------------------------------

function wolfPupArt(): SpeciesArt {
  return {
    overlay: {
      node: (
        <Path
          d="M84 102 Q104 94 98 70"
          stroke={WOLF_BODY}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
      ),
      motion: { kind: "rotate", amount: 6, duration: 2500, origin: "70% 74%" },
    },
    base: (
      <>
        {groundShadow}
        <Rect x={38} y={72} width={44} height={46} rx={20} fill={WOLF_BODY} />
        <Polygon points="38,36 46,8 58,32" fill={WOLF_BODY} />
        <Polygon points="82,36 74,8 62,32" fill={WOLF_BODY} />
        <Polygon points="43,31 47,15 54,29" fill={hue.sand} />
        <Polygon points="77,31 73,15 66,29" fill={hue.sand} />
        <Circle cx={60} cy={52} r={26} fill={WOLF_BODY} />
        <Ellipse cx={60} cy={64} rx={13} ry={9} fill={WOLF_MUZZLE} />
        <Circle cx={60} cy={60} r={2.5} fill={misc.eyeInk} />
        {eyes(48, 50, 70)}
      </>
    ),
  };
}

function foxArt(): SpeciesArt {
  return {
    overlay: {
      node: (
        <>
          <Path
            d="M82 104 Q106 98 100 78"
            stroke={FOX_BODY}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={100} cy={78} r={6} fill={FOX_WHITE} />
        </>
      ),
      motion: { kind: "translateX", amount: 3, duration: 3000, origin: "50% 50%" },
    },
    base: (
      <>
        {groundShadow}
        <Ellipse cx={60} cy={94} rx={26} ry={28} fill={FOX_BODY} />
        <Ellipse cx={60} cy={100} rx={13} ry={15} fill={FOX_WHITE} />
        <Polygon points="39,40 43,6 56,30" fill={FOX_BODY} />
        <Polygon points="81,40 77,6 64,30" fill={FOX_BODY} />
        <Polygon points="43,34 45,14 53,28" fill={misc.eyeInk} />
        <Polygon points="77,34 75,14 67,28" fill={misc.eyeInk} />
        <Circle cx={60} cy={50} r={24} fill={FOX_BODY} />
        <Ellipse cx={60} cy={62} rx={10} ry={7} fill={FOX_WHITE} />
        <Circle cx={60} cy={59} r={2.2} fill={misc.eyeInk} />
        <Ellipse cx={51} cy={48} rx={3.5} ry={1.7} fill={misc.eyeInk} />
        <Ellipse cx={69} cy={48} rx={3.5} ry={1.7} fill={misc.eyeInk} />
        <Path d="M44 60 L32 58 M44 63 L33 64" stroke={FOX_WHITE} strokeWidth={0.8} />
        <Path d="M76 60 L88 58 M76 63 L87 64" stroke={FOX_WHITE} strokeWidth={0.8} />
      </>
    ),
  };
}

function lionArt(): SpeciesArt {
  const petals: React.ReactNode[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = i * 45;
    const rad = (angle * Math.PI) / 180;
    const cx = 60 + Math.sin(rad) * 20;
    const cy = 48 - Math.cos(rad) * 20;
    petals.push(
      <Ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={10}
        ry={16}
        fill={i % 2 === 0 ? LION_MANE_DARK : LION_MANE_LIGHT}
        transform={`rotate(${angle} ${cx} ${cy})`}
      />,
    );
  }
  return {
    overlay: {
      node: (
        <>
          {petals}
          <Circle cx={60} cy={48} r={18} fill={LION_BODY} />
          <Circle cx={48} cy={34} r={5} fill={LION_MANE_DARK} />
          <Circle cx={72} cy={34} r={5} fill={LION_MANE_DARK} />
          <Ellipse cx={60} cy={56} rx={9} ry={7} fill={hue.sand} />
          <Circle cx={60} cy={53} r={2.2} fill={misc.eyeInk} />
          {eyes(45, 52, 68)}
        </>
      ),
      motion: { kind: "rotate", amount: 1.5, duration: anim.bambooSway, origin: "50% 34%" },
    },
    base: (
      <>
        {groundShadow}
        <Ellipse cx={60} cy={98} rx={26} ry={25} fill={LION_BODY} />
      </>
    ),
  };
}

function dogArt(): SpeciesArt {
  return {
    overlay: {
      node: (
        <Path
          d="M82 100 Q100 90 96 72"
          stroke={DOG_BODY}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
      ),
      motion: { kind: "rotate", amount: 10, duration: 1200, origin: "70% 72%" },
    },
    base: (
      <>
        {groundShadow}
        <Rect x={40} y={74} width={40} height={44} rx={18} fill={DOG_BODY} />
        <Rect x={44} y={78} width={32} height={5} rx={2.5} fill={gold.ink60} />
        <Circle cx={60} cy={52} r={25} fill={DOG_BODY} />
        <Rect x={30} y={40} width={13} height={28} rx={6.5} fill={DOG_EAR} />
        <Rect x={77} y={40} width={13} height={28} rx={6.5} fill={DOG_EAR} />
        <Ellipse cx={60} cy={64} rx={12} ry={9} fill={hue.sand} />
        <Circle cx={60} cy={60} r={2.5} fill={misc.eyeInk} />
        <Ellipse cx={60} cy={72} rx={4.5} ry={6} fill={DOG_TONGUE} />
        {eyes(48, 50, 70)}
      </>
    ),
  };
}

function humanArt(variant: "neutral" | "male" | "female"): SpeciesArt {
  const robe = variant === "female" ? FEMALE_ROBE : misc.robeMoss;
  const robeDeep = variant === "female" ? FEMALE_ROBE_DEEP : misc.robeMossDeep;
  const base = (
    <>
      {groundShadow}
      {/* Seated meditation pose: robe skirt, inner robe, shoulders, head */}
      <Path d="M36 126 Q36 92 60 86 Q84 92 84 126 Z" fill={robe} />
      <Rect x={52} y={92} width={16} height={30} rx={4} fill={robeDeep} />
      <Rect x={44} y={78} width={32} height={16} rx={8} fill={robe} />
      <Circle cx={60} cy={64} r={13} fill={misc.skinWarm} />
      <Ellipse cx={60} cy={56} rx={13.5} ry={8.5} fill={misc.hairDark} />
      <Rect x={46.5} y={55} width={4} height={9} rx={2} fill={misc.hairDark} />
      <Rect x={69.5} y={55} width={4} height={9} rx={2} fill={misc.hairDark} />
      {variant === "female" ? (
        <Circle cx={68} cy={53} r={2.2} fill={hue.blossom} />
      ) : null}
      {/* Resting hands */}
      <Ellipse cx={60} cy={100} rx={9} ry={4} fill={misc.skinWarm} />
    </>
  );
  if (variant === "female") {
    return {
      overlay: {
        node: (
          <>
            <Rect x={42} y={58} width={7} height={30} rx={3.5} fill={misc.hairDark} />
            <Rect x={71} y={58} width={7} height={30} rx={3.5} fill={misc.hairDark} />
          </>
        ),
        motion: { kind: "rotate", amount: 1.5, duration: 5000, origin: "50% 42%" },
      },
      base,
    };
  }
  return {
    base,
    baseMotion: { kind: "scaleY", amount: 0.015, duration: 4000, origin: "50% 100%" },
  };
}

function dragonkinArt(): SpeciesArt {
  return {
    overlay: {
      node: (
        <>
          <Polygon points="34,86 8,48 40,66" fill={DRAGON_WING} />
          <Polygon points="86,86 112,48 80,66" fill={DRAGON_WING} />
        </>
      ),
      motion: { kind: "scaleY", amount: 0.06, duration: 3500, origin: "50% 62%" },
    },
    base: (
      <>
        {groundShadow}
        <Ellipse cx={60} cy={94} rx={25} ry={27} fill={DRAGON_BODY} />
        <Circle cx={54} cy={86} r={3} fill="rgba(0,0,0,0.18)" />
        <Circle cx={64} cy={96} r={3} fill="rgba(0,0,0,0.18)" />
        <Circle cx={57} cy={106} r={3} fill="rgba(0,0,0,0.18)" />
        <Path
          d="M46 34 Q38 20 46 8"
          stroke={hue.sand}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M74 34 Q82 20 74 8"
          stroke={hue.sand}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={60} cy={52} r={22} fill={DRAGON_BODY} />
        <Rect x={49} y={45} width={3} height={8} rx={1.5} fill={gold.solid} />
        <Rect x={68} y={45} width={3} height={8} rx={1.5} fill={gold.solid} />
        <Ellipse cx={60} cy={64} rx={8} ry={5} fill="rgba(0,0,0,0.2)" />
      </>
    ),
    embers: true,
  };
}

function artFor(species: AvatarSpecies): SpeciesArt {
  switch (species) {
    case "wolf_pup":
      return wolfPupArt();
    case "fox":
      return foxArt();
    case "lion":
      return lionArt();
    case "dog":
      return dogArt();
    case "human_male":
      return humanArt("male");
    case "human_female":
      return humanArt("female");
    case "dragonkin":
      return dragonkinArt();
    case "neutral":
      return humanArt("neutral");
  }
}

// ---------------------------------------------------------------------------
// Motion wrappers
// ---------------------------------------------------------------------------

function useSecondaryStyle(motion: SecondaryMotion | undefined, enabled: boolean) {
  const value = useLoopValue(motion?.duration ?? 1000, 0, enabled && motion !== undefined);
  return useAnimatedStyle(() => {
    if (!motion) return {};
    const t = interpolate(value.value, [0, 1], [-1, 1]);
    switch (motion.kind) {
      case "rotate":
        return { transform: [{ rotate: `${t * motion.amount}deg` }] };
      case "translateX":
        return { transform: [{ translateX: t * motion.amount }] };
      case "scaleY":
        return { transform: [{ scaleY: 1 + value.value * motion.amount }] };
    }
  });
}

/** Rising ember mote (particle-rise) for the dragonkin. */
function Ember({ left, delay }: { left: number; delay: number }) {
  const progress = useCycleValue(anim.particleRise, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.4, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -40]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ember, { left: `${left}%` }, style]}
    />
  );
}

export function CompanionAvatar({ species, size = 120, animated = true }: CompanionAvatarProps) {
  const height = (size * VIEWBOX_H) / VIEWBOX_W;
  const art = artFor(species);

  // idle-sway: whole-figure breathing (translateY 0 -> -2px, 4s)
  const sway = useLoopValue(anim.idleSway, 0, animated);
  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sway.value, [0, 1], [0, -2]) }],
  }));

  const overlayStyle = useSecondaryStyle(art.overlay?.motion, animated);
  const baseStyle = useSecondaryStyle(art.baseMotion, animated);

  return (
    <Animated.View style={[{ width: size, height }, swayStyle]}>
      {art.overlay ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transformOrigin: art.overlay.motion.origin },
            overlayStyle,
          ]}
        >
          <Svg width={size} height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
            {art.overlay.node}
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          art.baseMotion ? { transformOrigin: art.baseMotion.origin } : null,
          baseStyle,
        ]}
      >
        <Svg width={size} height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
          {art.base}
        </Svg>
      </Animated.View>
      {art.embers && animated ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Ember left={30} delay={0} />
          <Ember left={66} delay={2200} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ember: {
    position: "absolute",
    bottom: "18%",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: gold.solid,
  },
});
