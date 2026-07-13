/**
 * Bottom sheet — the contextual-overlay pattern the v3 restructure applies
 * everywhere (app-restructure-v3.md): Chat, Intentions, and Reflection all
 * slide over the World instead of replacing it. This is the one primitive
 * all three reuse (mirrors the mockup's `.scrim`/`.sheet`/`.sheet-handle`
 * markup) — glassHeavy bottom-sheet recipe (tokens.md section 6): fill
 * `scrim.sheet`, border `line.10`, radius 28/28/0/0.
 */
import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { line, misc, radius } from "./tokens";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Cap the sheet's height (e.g. leave room above for context); defaults to 82% of the screen. */
  maxHeightPct?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

const ANIM_MS = 300;

export function Sheet({ visible, onClose, maxHeightPct = 0.82, style, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.6,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 120 }],
  }));

  // Keep mounted while animating out so the slide-down reads; fully unmount
  // once invisible to avoid stray touch targets under the World.
  const [mounted, setMounted] = React.useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: `${maxHeightPct * 100}%`, paddingBottom: Math.max(insets.bottom, 16) },
          sheetStyle,
          style,
        ]}
      >
        <View style={styles.handle} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: misc.shadowFigure,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: misc.scrimSheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: line[18],
    marginBottom: 14,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
});
