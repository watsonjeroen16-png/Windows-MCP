/**
 * Chat bubble — companion anchors top-left (4/16/16/16), user anchors
 * top-right (16/4/16/16). Companion text is always the voice style.
 */
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { gold, line, mist, radius } from "./tokens";

interface ChatBubbleProps {
  role: "companion" | "user";
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

export function ChatBubble({ role, style, children }: ChatBubbleProps) {
  return (
    <View style={[styles.base, role === "companion" ? styles.companion : styles.user, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  companion: {
    backgroundColor: mist[7],
    borderColor: line[10],
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  user: {
    backgroundColor: gold.fill10,
    borderColor: gold.line20,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.xs,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
});
