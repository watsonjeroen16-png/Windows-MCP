/**
 * Glass surface recipes — tokens.md section 6. Glass reads via border + fill,
 * never elevation, so there is deliberately no shadow.
 */
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { line, mist, radius } from "./tokens";

export type GlassVariant = "subtle" | "standard" | "heavy";

interface GlassCardProps {
  variant?: GlassVariant;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

const RECIPES: Record<GlassVariant, ViewStyle> = {
  subtle: {
    backgroundColor: mist[5],
    borderColor: line[8],
    borderRadius: radius.xl,
  },
  standard: {
    backgroundColor: mist[7],
    borderColor: line[14],
    borderRadius: radius.card,
  },
  heavy: {
    backgroundColor: mist[10],
    borderColor: line[18],
    borderRadius: radius.hero,
  },
};

export function GlassCard({
  variant = "standard",
  radius: radiusOverride,
  style,
  children,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.base,
        RECIPES[variant],
        radiusOverride !== undefined ? { borderRadius: radiusOverride } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});
