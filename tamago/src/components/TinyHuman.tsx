import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

import { MOOD_EMOJI, Mood, Stage } from "../state/petLogic";
import { colors } from "../theme";

interface Props {
  faceUri: string;
  mood: Mood;
  stage: Stage;
}

const STAGE_SCALE: Record<Stage, number> = { baby: 0.72, kid: 0.88, adult: 1 };

/** Shirt color follows the mood, like a tiny mood ring. */
const SHIRT_COLOR: Record<Mood, string> = {
  ecstatic: colors.bodyAwake,
  happy: colors.bodyAwake,
  okay: colors.bodyAwake,
  grumpy: colors.warn,
  sick: colors.bodySick,
  asleep: colors.bodyAsleep,
};

const SKIN = "#F1C6A7";
const PANTS = "#4A5A8A";
const SHOES = "#3D2C3A";

/**
 * A tiny human: the scanned face photo clipped into a circle for the head,
 * on a little body with a shirt, arms, pants, and shoes. Bounces while
 * awake, stands still with dimmed eyes while asleep.
 */
export default function TinyHuman({ faceUri, mood, stage }: Props) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mood === "asleep") {
      bob.stopAnimation();
      bob.setValue(0);
      return;
    }
    const fast = mood === "ecstatic" || mood === "happy";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: fast ? 450 : 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: fast ? 450 : 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, mood]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  // Arms swing up a little at the top of each bounce.
  const armSwing = bob.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-18deg"] });
  const armSwingRight = bob.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "18deg"] });
  const scale = STAGE_SCALE[stage];
  const shirt = SHIRT_COLOR[mood];

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.human, { transform: [{ translateY }, { scale }] }]}>
        <Text style={styles.moodBubble}>{MOOD_EMOJI[mood]}</Text>

        <View style={styles.head}>
          <Image source={{ uri: faceUri }} style={styles.face} />
          {mood === "asleep" && <View style={styles.eyelids} />}
        </View>

        <View style={styles.torsoRow}>
          <Animated.View
            style={[styles.arm, styles.armLeft, { backgroundColor: shirt, transform: [{ rotate: armSwing }] }]}
          >
            <View style={styles.hand} />
          </Animated.View>

          <View style={[styles.torso, { backgroundColor: shirt }]}>
            <View style={styles.collar} />
            <Text style={styles.shirtHeart}>♥</Text>
          </View>

          <Animated.View
            style={[styles.arm, styles.armRight, { backgroundColor: shirt, transform: [{ rotate: armSwingRight }] }]}
          >
            <View style={styles.hand} />
          </Animated.View>
        </View>

        <View style={styles.legs}>
          <View style={styles.leg}>
            <View style={styles.shoe} />
          </View>
          <View style={styles.leg}>
            <View style={styles.shoe} />
          </View>
        </View>
      </Animated.View>
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  human: { alignItems: "center" },
  moodBubble: { fontSize: 30, marginBottom: 4 },
  head: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden",
    borderWidth: 5,
    borderColor: "#fff",
    zIndex: 2,
    backgroundColor: colors.accentSoft,
  },
  face: { width: "100%", height: "100%" },
  eyelids: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(60,40,80,0.45)",
  },
  torsoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: -18,
    zIndex: 1,
  },
  torso: {
    width: 92,
    height: 86,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignItems: "center",
  },
  collar: {
    width: 34,
    height: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  shirtHeart: { color: "rgba(255,255,255,0.75)", fontSize: 20, marginTop: 10 },
  arm: {
    width: 22,
    height: 62,
    borderRadius: 11,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  armLeft: { marginRight: -6, transformOrigin: "top center" },
  armRight: { marginLeft: -6, transformOrigin: "top center" },
  hand: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: SKIN,
    marginBottom: -6,
  },
  legs: { flexDirection: "row", gap: 10, marginTop: -2 },
  leg: {
    width: 24,
    height: 46,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: PANTS,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  shoe: {
    width: 32,
    height: 14,
    borderRadius: 7,
    backgroundColor: SHOES,
    marginBottom: -6,
  },
  shadow: {
    width: 120,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(61,44,58,0.12)",
    marginTop: 12,
  },
});
