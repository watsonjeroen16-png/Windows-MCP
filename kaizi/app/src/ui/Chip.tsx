/**
 * Selection chip — pill, states per tokens.md section 6 chip table.
 * Selection adds a single xp-pop; state changes cross-fade in 250ms.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { useXpPop } from "./motion";
import { gold, hue, line, mist, radius, text, type } from "./tokens";

interface ChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, disabled = false, onPress }: ChipProps) {
  const [pressed, setPressed] = useState(false);
  const popStyle = useXpPop(selected);

  const fill = disabled
    ? "transparent"
    : selected
      ? gold.fill20
      : pressed
        ? mist[16]
        : "transparent";
  const border = disabled ? line[8] : selected ? gold.line40 : pressed ? line[22] : line[15];
  const labelColor = disabled ? text.trace : selected ? gold.solid : pressed ? hue.cream : text.soft;

  return (
    <Animated.View style={popStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.base, { backgroundColor: fill, borderColor: border }]}
      >
        <Text style={[type.buttonSm, { color: labelColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
});
