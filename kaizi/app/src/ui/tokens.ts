/**
 * Kaizi design tokens — transcribed 1:1 from kaizi/docs/design/tokens.md.
 * All rgba values are exact; do not round.
 *
 * Note on letter-spacing: the design doc uses em units (web). React Native
 * letterSpacing is in points, so styles below pre-multiply em x fontSize.
 */

// ---------------------------------------------------------------------------
// 1. Color palette
// ---------------------------------------------------------------------------

export const ground = {
  base: "#0E0D0B",
  deep: "#0A0907",
  warm: "#0E0C09",
  panel: "#0B0A08",
  night: "#080907",
  nightDeepest: "#060808",
  gardenNight: "#090C0A",
} as const;

/** Zen-garden scenery fills (SVG layers, use verbatim in ZenBackground). */
export const scenery = {
  welcomeHillA: "#1A1510",
  welcomeHillB: "#221C14",
  bambooWelcome: "#2A2218",
  gardenBedA: "#141008",
  gardenBedB: "#0E0C08",
  world: ["#0F1A12", "#0E1610", "#0C1209", "#0A1108", "#0D1A0E", "#111F12", "#0F2010", "#122514"],
  bambooWorld: "#1A2A16",
  stones: ["#1C1208", "#1E1408", "#2A1A08"],
  lanternWood: ["#3A2010", "#2A1808"],
} as const;

export const hue = {
  ink: "#1C1A17",
  stone: "#2E2B27",
  pebble: "#4A4640",
  cream: "#F0EBE0",
  sand: "#C8B89A",
  gold: "#D4A853",
  fog: "rgba(240,235,224,0.55)",
  blossom: "rgba(230,180,190,0.7)",
} as const;

export const blossomVariants = [
  "rgba(220,160,175,0.6)",
  "rgba(215,155,170,0.7)",
  "rgba(200,140,155,0.4)",
] as const;

/** Mist — white glass fills. Access as mist[7] etc. */
export const mist = {
  4: "rgba(255,255,255,0.04)",
  5: "rgba(255,255,255,0.05)",
  6: "rgba(255,255,255,0.06)",
  7: "rgba(255,255,255,0.07)",
  9: "rgba(255,255,255,0.09)",
  10: "rgba(255,255,255,0.10)",
  16: "rgba(255,255,255,0.16)",
} as const;

/** Hairline borders (white). All borders are 0.5px (StyleSheet.hairlineWidth). */
export const line = {
  5: "rgba(255,255,255,0.05)",
  6: "rgba(255,255,255,0.06)",
  8: "rgba(255,255,255,0.08)",
  10: "rgba(255,255,255,0.10)",
  12: "rgba(255,255,255,0.12)",
  14: "rgba(255,255,255,0.14)",
  15: "rgba(255,255,255,0.15)", // chip default border
  18: "rgba(255,255,255,0.18)",
  20: "rgba(255,255,255,0.20)",
  22: "rgba(255,255,255,0.22)",
} as const;

/** Cream text alphas. */
export const text = {
  primary: "#F0EBE0",
  body: "rgba(240,235,224,0.7)",
  soft: "rgba(240,235,224,0.5)",
  muted: "rgba(240,235,224,0.4)",
  faint: "rgba(240,235,224,0.35)",
  micro: "rgba(240,235,224,0.3)",
  ghost: "rgba(240,235,224,0.25)",
  trace: "rgba(240,235,224,0.2)",
  trace15: "rgba(240,235,224,0.15)",
} as const;

/** Gold alphas. */
export const gold = {
  glow4: "rgba(212,168,83,0.04)",
  glow5: "rgba(212,168,83,0.05)",
  glow6: "rgba(212,168,83,0.06)",
  glow8: "rgba(212,168,83,0.08)",
  fill10: "rgba(212,168,83,0.10)",
  fill12: "rgba(212,168,83,0.12)",
  fill20: "rgba(212,168,83,0.20)",
  line15: "rgba(212,168,83,0.15)",
  line20: "rgba(212,168,83,0.20)",
  line22: "rgba(212,168,83,0.22)",
  line25: "rgba(212,168,83,0.25)",
  line30: "rgba(212,168,83,0.30)",
  line40: "rgba(212,168,83,0.40)",
  ink50: "rgba(212,168,83,0.50)",
  ink60: "rgba(212,168,83,0.60)",
  ink70: "rgba(212,168,83,0.70)",
  ink80: "rgba(212,168,83,0.80)",
  ink90: "rgba(212,168,83,0.90)",
  icon90: "rgba(212,168,83,0.90)",
  solid: "#D4A853",
} as const;

/** Misc. */
export const misc = {
  shadowFigure: "rgba(0,0,0,0.35)",
  scrimNav: "rgba(14,13,11,0.75)",
  scrimSheet: "rgba(14,13,11,0.82)",
  koiRed: "rgba(200,80,60,0.6)",
  koiGold: "rgba(240,180,60,0.5)",
  skinWarm: "#C8A882",
  hairDark: "#1A1208",
  robeMoss: "#2A3525",
  robeMossDeep: "#1E2A1A",
  eyeInk: "#1A1A22",
  white: "#FFFFFF",
} as const;

/** Error state colors (input recipe, tokens.md section 6). */
export const error = {
  border: "rgba(200,80,60,0.5)",
  message: "rgba(230,140,120,0.8)",
} as const;

// ---------------------------------------------------------------------------
// 2. Typography
// ---------------------------------------------------------------------------

/**
 * Font families. Loaded via expo-google-fonts in App.tsx; the token layer is
 * the single indirection point — swapping families is a one-line change here.
 * Serif = meaning (titles, values, companion voice). Sans = structure.
 */
export const font = {
  serifLight: "CormorantGaramond_300Light",
  serifLightItalic: "CormorantGaramond_300Light_Italic",
  serifRegular: "CormorantGaramond_400Regular",
  serifRegularItalic: "CormorantGaramond_400Regular_Italic",
  sansLight: "Inter_300Light",
  sansRegular: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
} as const;

import type { TextStyle } from "react-native";

const em = (emValue: number, fontSize: number): number => emValue * fontSize;

/** Type scale — tokens.md section 2. letterSpacing pre-multiplied from em. */
export const type = {
  wordmark: {
    fontFamily: font.serifLight,
    fontSize: 48,
    letterSpacing: em(0.12, 48),
    lineHeight: 48,
    color: hue.cream,
  } as TextStyle,
  display: {
    fontFamily: font.serifLight,
    fontSize: 31,
    letterSpacing: em(-0.01, 31),
    lineHeight: 34,
    color: hue.cream,
  } as TextStyle,
  title: {
    fontFamily: font.serifLight,
    fontSize: 28,
    letterSpacing: em(-0.01, 28),
    lineHeight: 32,
    color: hue.cream,
  } as TextStyle,
  stat: {
    fontFamily: font.serifLight,
    fontSize: 26,
    lineHeight: 29,
    color: hue.cream,
  } as TextStyle,
  heading: {
    fontFamily: font.serifLight,
    fontSize: 23,
    letterSpacing: em(0.01, 23),
    lineHeight: 28,
    color: hue.cream,
  } as TextStyle,
  reward: {
    fontFamily: font.serifRegular,
    fontSize: 18,
    lineHeight: 22,
    color: gold.solid,
  } as TextStyle,
  bodySerif: {
    fontFamily: font.serifLight,
    fontSize: 16,
    lineHeight: 24,
    color: hue.cream,
  } as TextStyle,
  /** Companion voice — every word the companion says is serif italic cream. */
  voice: {
    fontFamily: font.serifLightItalic,
    fontSize: 15,
    lineHeight: 24,
    color: hue.cream,
  } as TextStyle,
  tagline: {
    fontFamily: font.serifLightItalic,
    fontSize: 16,
    letterSpacing: em(0.06, 16),
    lineHeight: 24,
    color: hue.sand,
  } as TextStyle,
  subSerif: {
    fontFamily: font.serifLightItalic,
    fontSize: 13,
    lineHeight: 18,
    color: text.faint,
  } as TextStyle,
  bodySans: {
    fontFamily: font.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: hue.cream,
  } as TextStyle,
  buttonLg: {
    fontFamily: font.sansRegular,
    fontSize: 14,
    letterSpacing: em(0.12, 14),
    lineHeight: 14,
    textTransform: "uppercase",
    color: hue.cream,
  } as TextStyle,
  buttonSm: {
    fontFamily: font.sansRegular,
    fontSize: 11,
    letterSpacing: em(0.09, 11),
    lineHeight: 11,
    textTransform: "uppercase",
    color: hue.cream,
  } as TextStyle,
  tab: {
    fontFamily: font.sansRegular,
    fontSize: 10,
    letterSpacing: em(0.08, 10),
    lineHeight: 10,
    textTransform: "uppercase",
    color: text.faint,
  } as TextStyle,
  micro: {
    fontFamily: font.sansRegular,
    fontSize: 9,
    letterSpacing: em(0.11, 9),
    lineHeight: 9,
    textTransform: "uppercase",
    color: text.micro,
  } as TextStyle,
  meta: {
    fontFamily: font.sansRegular,
    fontSize: 11,
    letterSpacing: em(0.05, 11),
    lineHeight: 14,
    color: text.muted,
  } as TextStyle,
} as const;

// ---------------------------------------------------------------------------
// 3. Radii
// ---------------------------------------------------------------------------

export const radius = {
  xs: 4,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  card: 24,
  hero: 28,
  pill: 999,
  device: 50,
} as const;

// ---------------------------------------------------------------------------
// 4. Spacing
// ---------------------------------------------------------------------------

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 32,
  jumbo: 40,
  footer: 60,
} as const;

export const fixed = {
  statusBar: 54,
  navPill: 86,
  ctaPaddingV: 17,
} as const;

// ---------------------------------------------------------------------------
// 5. Animation vocabulary — durations (ms) and amplitudes
// ---------------------------------------------------------------------------

export const anim = {
  blossomFallMin: 8000,
  blossomFallMax: 18000,
  bambooSway: 4500,
  waterRipple: 3500,
  lanternGlow: 3000,
  idleSway: 4000,
  koiSwim: 6000,
  particleRise: 5000,
  fogDrift: 10000,
  cardSlideIn: 380,
  swipe: 400,
  xpPop: 350,
  micro: 250,
  press: 120,
} as const;

/** Everything, namespaced, for consumers that prefer one import. */
export const tokens = {
  ground,
  scenery,
  hue,
  blossomVariants,
  mist,
  line,
  text,
  gold,
  misc,
  error,
  font,
  type,
  radius,
  space,
  fixed,
  anim,
} as const;

export default tokens;
