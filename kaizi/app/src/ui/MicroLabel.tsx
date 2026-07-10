/** Uppercase Inter micro-label (9-11px) — section eyebrows and metadata. */
import React from "react";
import { Text, TextStyle } from "react-native";

import { gold, text, type } from "./tokens";

type MicroTone = "default" | "gold" | "ghost";

interface MicroLabelProps {
  tone?: MicroTone;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
}

const TONE_COLORS: Record<MicroTone, string> = {
  default: text.micro,
  gold: gold.ink60,
  ghost: text.ghost,
};

export function MicroLabel({ tone = "default", style, children }: MicroLabelProps) {
  return <Text style={[type.micro, { color: TONE_COLORS[tone] }, style]}>{children}</Text>;
}
