/**
 * OnboardingScreen — shared chrome for screens 2-7: progress dots centered
 * under the status bar, 36x36 back affordance top-left, content slot, and a
 * full-width CTA pinned above the home indicator (inset space.xxxl, footer
 * clearance) with optional microcopy. Wraps content in KeyboardAvoidingView
 * when a screen needs the CTA docked above the keyboard (screen 3, 7a).
 */
import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "./BackChevron";
import { MicroLabel } from "./MicroLabel";
import { SlideIn, type SlideDirection } from "./motion";
import { ProgressDots, ProgressDotsComplete } from "./ProgressDots";
import { SerifTitle } from "./SerifTitle";
import { font, hue, space, text, type } from "./tokens";

interface OnboardingScreenProps {
  /** 1-based step for the dots; screens 2-7 show them, 1 hides them. */
  step: number;
  /** All-gold dots on the terminal handoff screen. */
  dotsComplete?: boolean;
  onBack?: () => void;
  direction: SlideDirection;
  children: React.ReactNode;
  /** CTA slot (GoldButton) pinned above the home indicator. */
  cta?: React.ReactNode;
  microcopy?: string;
  keyboardAvoiding?: boolean;
}

export function OnboardingScreen({
  step,
  dotsComplete = false,
  onBack,
  direction,
  children,
  cta,
  microcopy,
  keyboardAvoiding = false,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const showDots = step >= 2;

  const body = (
    <SlideIn direction={direction}>
      <View style={styles.content}>{children}</View>
      {cta !== undefined || microcopy !== undefined ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 36 }]}>
          {cta}
          {microcopy !== undefined ? <Text style={styles.microcopy}>{microcopy}</Text> : null}
        </View>
      ) : null}
    </SlideIn>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.chrome}>
        {onBack !== undefined ? (
          <View style={styles.backSlot}>
            <BackChevron onPress={onBack} />
          </View>
        ) : null}
        {showDots ? (
          dotsComplete ? (
            <ProgressDotsComplete />
          ) : (
            <ProgressDots current={step} />
          )
        ) : null}
      </View>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

/** Standard header block: eyebrow micro-label, serif title, italic subtitle. */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  subtitleColor = hue.sand,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  subtitleColor?: string;
}) {
  return (
    <View style={styles.header}>
      <MicroLabel>{eyebrow}</MicroLabel>
      <SerifTitle size="title" style={styles.headerTitle}>
        {title}
      </SerifTitle>
      {subtitle !== undefined ? (
        <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  chrome: {
    minHeight: 36,
    justifyContent: "center",
  },
  backSlot: {
    position: "absolute",
    left: space.md,
    zIndex: 2,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.xxxl,
  },
  microcopy: {
    ...type.subSerif,
    fontSize: 12,
    lineHeight: 17,
    color: text.faint,
    textAlign: "center",
    marginTop: 12,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: space.xxl,
  },
  headerTitle: {
    marginTop: 10,
  },
  headerSubtitle: {
    fontFamily: font.serifLightItalic,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
