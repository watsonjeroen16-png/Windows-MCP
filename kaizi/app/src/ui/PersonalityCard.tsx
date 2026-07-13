/**
 * PersonalityCard — screen 5. glassSubtle card with the personality name,
 * one-word tag, and the canonical sample dialogue line (verbatim from
 * src/data/personalities.ts) inside a companion chat bubble.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import type { PersonalityId } from "../data/ids";
import { PERSONALITIES } from "../data/personalities";
import { ChatBubble } from "./ChatBubble";
import { CompanionVoice } from "./CompanionVoice";
import { MicroLabel } from "./MicroLabel";
import { useXpPop } from "./motion";
import { font, gold, hue, line, mist, radius } from "./tokens";

interface PersonalityCardProps {
  id: PersonalityId;
  selected: boolean;
  onPress: () => void;
}

export function PersonalityCard({ id, selected, onPress }: PersonalityCardProps) {
  const meta = PERSONALITIES.find((p) => p.id === id);
  const popStyle = useXpPop(selected);
  if (!meta) return null;

  return (
    <Animated.View style={popStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.card, selected ? styles.cardSelected : null]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: selected ? gold.solid : hue.cream }]}>
            {meta.name}
          </Text>
          <MicroLabel>{meta.tag}</MicroLabel>
        </View>
        <View style={styles.bubbleBlock}>
          <MicroLabel tone="ghost" style={styles.mightSay}>
            THEY MIGHT SAY
          </MicroLabel>
          <ChatBubble role="companion">
            <CompanionVoice>{meta.sampleLine}</CompanionVoice>
          </ChatBubble>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mist[5],
    borderColor: line[8],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardSelected: {
    borderColor: gold.line40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontFamily: font.serifLight,
    fontSize: 17,
    lineHeight: 22,
  },
  bubbleBlock: {
    marginTop: 10,
  },
  mightSay: {
    marginBottom: 6,
  },
});
