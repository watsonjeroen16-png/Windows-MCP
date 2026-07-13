/** Back affordance — 36x36 tap target, 20px chevron-left, stroke 1.5. */
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { text } from "./tokens";

interface BackChevronProps {
  onPress: () => void;
}

export function BackChevron({ onPress }: BackChevronProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={6}
      style={styles.target}
    >
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path
          d="M12.5 4 L7 10 L12.5 16"
          stroke={text.faint}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
