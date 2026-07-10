/**
 * CodeInput — screen 7b. Six 44x54 boxes backed by one hidden TextInput so
 * iOS one-time-code autofill and the Android SMS retriever both work
 * (textContentType="oneTimeCode" / autoComplete="one-time-code").
 * Auto-submits on the 6th digit; on a wrong code the parent bumps
 * `shakeNonce`, which shakes the row, flashes the borders, clears the
 * boxes, and returns focus to the first box.
 */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { useShake, useXpPop } from "./motion";
import { error as errorColor, font, hue, line, mist, radius } from "./tokens";

interface CodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  /** Increment to trigger the error shake + clear + refocus. */
  shakeNonce: number;
  /** While true, input is locked (inline spinner shows elsewhere). */
  disabled?: boolean;
}

function DigitBox({
  digit,
  focused,
  errorFlash,
}: {
  digit: string;
  focused: boolean;
  errorFlash: boolean;
}) {
  const popStyle = useXpPop(digit !== "");
  return (
    <Animated.View
      style={[
        styles.box,
        focused ? { borderColor: line[22] } : null,
        errorFlash ? { borderColor: errorColor.border } : null,
        popStyle,
      ]}
    >
      <Text style={styles.digit}>{digit}</Text>
    </Animated.View>
  );
}

export function CodeInput({ length = 6, onComplete, shakeNonce, disabled = false }: CodeInputProps) {
  const [value, setValue] = useState("");
  const [errorFlash, setErrorFlash] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const shakeStyle = useShake(shakeNonce);

  // Wrong code: shake, flash borders, clear, refocus first box.
  useEffect(() => {
    if (shakeNonce > 0) {
      setErrorFlash(true);
      const timer = setTimeout(() => {
        setValue("");
        setErrorFlash(false);
        inputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [shakeNonce]);

  const handleChange = (raw: string) => {
    if (disabled) return;
    const digits = raw.replace(/\D/g, "").slice(0, length);
    setValue(digits);
    if (digits.length === length) {
      onComplete(digits);
    }
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code">
      <Animated.View style={[styles.row, shakeStyle]}>
        {Array.from({ length }, (_, index) => (
          <DigitBox
            key={index}
            digit={value[index] ?? ""}
            focused={!disabled && index === Math.min(value.length, length - 1)}
            errorFlash={errorFlash}
          />
        ))}
      </Animated.View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={length}
        editable={!disabled}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  box: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: mist[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[12],
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontFamily: font.serifLight,
    fontSize: 24,
    color: hue.cream,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
});
