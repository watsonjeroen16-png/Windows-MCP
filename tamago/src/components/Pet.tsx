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

const BODY_COLOR: Record<Mood, string> = {
  ecstatic: colors.bodyAwake,
  happy: colors.bodyAwake,
  okay: colors.bodyAwake,
  grumpy: colors.warn,
  sick: colors.bodySick,
  asleep: colors.bodyAsleep,
};

/**
 * The pet itself: the scanned face photo clipped into a circle for the head,
 * sitting on a cartoon blob body. Bobs gently while awake, lies still asleep.
 */
export default function Pet({ faceUri, mood, stage }: Props) {
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
  const scale = STAGE_SCALE[stage];

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.pet, { transform: [{ translateY }, { scale }] }]}>
        <Text style={styles.moodBubble}>{MOOD_EMOJI[mood]}</Text>
        <View style={styles.head}>
          <Image source={{ uri: faceUri }} style={styles.face} />
          {mood === "asleep" && <View style={styles.eyelids} />}
        </View>
        <View style={[styles.body, { backgroundColor: BODY_COLOR[mood] }]}>
          <View style={styles.belly} />
        </View>
        <View style={styles.feet}>
          <View style={[styles.foot, { backgroundColor: BODY_COLOR[mood] }]} />
          <View style={[styles.foot, { backgroundColor: BODY_COLOR[mood] }]} />
        </View>
      </Animated.View>
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  pet: { alignItems: "center" },
  moodBubble: { fontSize: 30, marginBottom: 4 },
  head: {
    width: 150,
    height: 150,
    borderRadius: 75,
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
  body: {
    width: 130,
    height: 105,
    borderRadius: 55,
    marginTop: -28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  belly: {
    width: 62,
    height: 48,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginTop: 22,
  },
  feet: { flexDirection: "row", gap: 34, marginTop: -12 },
  foot: { width: 34, height: 20, borderRadius: 10 },
  shadow: {
    width: 120,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(61,44,58,0.12)",
    marginTop: 8,
  },
});
