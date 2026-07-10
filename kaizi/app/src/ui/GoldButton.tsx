/**
 * Pill CTA — goldButton recipes from tokens.md section 6, plus the disabled
 * recipe used across screens 2-7 (transparent fill, line.8 border,
 * text.trace label, non-pressable).
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { anim, fixed, gold, hue, line, mist, radius, text, type } from "./tokens";

export type GoldButtonVariant = "quiet" | "emphatic" | "heroNeutral" | "secondary";

interface GoldButtonProps {
  label: string;
  variant?: GoldButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  /** Optional label color override (e.g. the 600ms "REMEMBERED" swap). */
  labelColor?: string;
  style?: ViewStyle | ViewStyle[];
}

interface VariantRecipe {
  container: ViewStyle;
  pressedFill: string;
  label: TextStyle;
}

const RECIPES: Record<GoldButtonVariant, VariantRecipe> = {
  quiet: {
    container: { backgroundColor: gold.fill10, borderColor: gold.line22, paddingVertical: 16 },
    pressedFill: gold.fill20,
    label: { ...type.buttonSm, color: gold.solid },
  },
  emphatic: {
    container: { backgroundColor: gold.fill20, borderColor: gold.line40, paddingVertical: 16 },
    pressedFill: gold.fill20,
    label: { ...type.buttonSm, color: gold.solid },
  },
  heroNeutral: {
    container: {
      backgroundColor: mist[10],
      borderColor: line[22],
      paddingVertical: fixed.ctaPaddingV + 1,
    },
    pressedFill: mist[16],
    label: { ...type.buttonLg, color: hue.cream },
  },
  secondary: {
    container: { backgroundColor: mist[5], borderColor: line[10], paddingVertical: 16 },
    pressedFill: mist[10],
    label: { ...type.buttonSm, color: text.faint },
  },
};

const DISABLED_CONTAINER: ViewStyle = {
  backgroundColor: "transparent",
  borderColor: line[8],
};

export function GoldButton({
  label,
  variant = "quiet",
  disabled = false,
  onPress,
  labelColor,
  style,
}: GoldButtonProps) {
  const recipe = RECIPES[variant];
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (disabled) return;
    setPressed(true);
    scale.value = withTiming(0.98, { duration: anim.press, easing: Easing.out(Easing.ease) });
  };
  const handlePressOut = () => {
    setPressed(false);
    scale.value = withTiming(1, { duration: anim.press, easing: Easing.out(Easing.ease) });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.base,
          recipe.container,
          pressed && !disabled ? { backgroundColor: recipe.pressedFill } : null,
          disabled ? DISABLED_CONTAINER : null,
          style,
        ]}
      >
        <Text
          style={[
            recipe.label,
            disabled ? { color: text.trace } : null,
            labelColor !== undefined && !disabled ? { color: labelColor } : null,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
