/**
 * Screen 3 — Identity Input. Collects identityWhy (trimmed 10-280 chars),
 * the sentence that seeds the companion's long-term memory. The quietest
 * screen: ground.night, 2 slow blossoms, keyboard-docked CTA.
 * On save the CTA label swaps to REMEMBERED in gold for 600ms, then advances.
 */
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  isIdentityWhyValid,
  MAX_WHY_LENGTH,
  useOnboarding,
} from "../state/OnboardingContext";
import { GoldButton } from "../ui/GoldButton";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { gold, hue, line, mist, radius, space, text, type } from "../ui/tokens";

const PLACEHOLDER =
  "Because I'm tired of almost. Because my kids are watching. Because I promised myself…";

export function IdentityInputScreen() {
  const { state, dispatch } = useOnboarding();
  const [touched, setTouched] = useState(state.identityWhy.length > 0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const valid = isIdentityWhyValid(state.identityWhy);

  // Auto-focus 400ms after the slide-in transition settles.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    if (!valid || saving) return;
    setSaving(true);
    Keyboard.dismiss();
    // Brief xp-pop moment: label reads REMEMBERED for 600ms, then navigate.
    setTimeout(() => {
      setSaving(false);
      dispatch({ kind: "next" });
    }, 600);
  };

  return (
    <OnboardingScreen
      step={3}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      keyboardAvoiding
      cta={
        <GoldButton
          label={saving ? "REMEMBERED" : "SAVE TO MEMORY"}
          variant="quiet"
          disabled={!valid && !saving}
          labelColor={saving ? gold.solid : undefined}
          onPress={handleSave}
        />
      }
      microcopy="This becomes the first thing your companion knows about you"
    >
      <ScreenHeader
        eyebrow="YOUR WHY"
        title="Why are you doing this?"
        subtitle="Say it honestly. Your companion will remember."
      />
      <Pressable style={styles.inputWrap} onPress={() => Keyboard.dismiss()}>
        <View style={styles.textareaFrame}>
          <TextInput
            ref={inputRef}
            style={styles.textarea}
            multiline
            value={state.identityWhy}
            onChangeText={(value) => {
              if (!touched && value.length > 0) setTouched(true);
              dispatch({ kind: "set_identity_why", text: value });
            }}
            placeholder={PLACEHOLDER}
            placeholderTextColor={text.faint}
            maxLength={MAX_WHY_LENGTH}
            textAlignVertical="top"
            accessibilityLabel="Why are you doing this?"
          />
          {touched ? (
            <Text style={styles.counter}>
              {state.identityWhy.length}/{MAX_WHY_LENGTH}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flex: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.xxl,
  },
  textareaFrame: {
    backgroundColor: mist[4],
    borderColor: line[10],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: 16,
    minHeight: 160,
  },
  textarea: {
    ...type.bodySans,
    fontSize: 15,
    lineHeight: 24,
    color: hue.cream,
    minHeight: 128,
    padding: 0,
  },
  counter: {
    ...type.meta,
    color: text.ghost,
    textAlign: "right",
    marginTop: 8,
  },
});
