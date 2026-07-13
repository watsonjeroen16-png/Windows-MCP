/**
 * Companion voice text — every word the companion says is quoted serif
 * italic cream (tokens.md typography rules).
 */
import React from "react";
import { Text, TextStyle } from "react-native";

import { type } from "./tokens";

interface CompanionVoiceProps {
  size?: number;
  style?: TextStyle | TextStyle[];
  children: string;
}

export function CompanionVoice({ size, style, children }: CompanionVoiceProps) {
  return (
    <Text
      style={[
        type.voice,
        size !== undefined ? { fontSize: size, lineHeight: Math.round(size * 1.55) } : null,
        style,
      ]}
    >
      {"“"}
      {children}
      {"”"}
    </Text>
  );
}
