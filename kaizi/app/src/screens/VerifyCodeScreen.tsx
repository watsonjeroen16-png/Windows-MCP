/**
 * Screen 7b — Verification code. Six boxes, auto-submit on the 6th digit,
 * inline gold-dot spinner while verifying, 30s resend countdown, shake +
 * clear on a wrong code, forced resend after 5 failures.
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { verifyCheck, verifyStart } from "../api/client";
import { formatNational } from "../ui/PhoneInput";
import { COUNTRIES } from "../data/countries";
import { useOnboarding } from "../state/OnboardingContext";
import { CodeInput } from "../ui/CodeInput";
import { ListeningDots } from "../ui/ListeningDots";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { error as errorColor, gold, space, text, type } from "../ui/tokens";

const RESEND_SECONDS = 30;
const MAX_FAILURES = 5;

const ERROR_WRONG = "That code didn't match. Try again.";
const ERROR_NETWORK = "We couldn't check the code. Try again in a moment.";
const ERROR_FORCED_RESEND = "Too many tries. We sent you a fresh code.";

function formatPhoneForDisplay(phone: string): string {
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => phone.startsWith(c.dial));
  if (!match) return phone;
  return `${match.dial} ${formatNational(phone.slice(match.dial.length), match.dial)}`;
}

export function VerifyCodeScreen() {
  const { state, dispatch } = useOnboarding();
  const [verifying, setVerifying] = useState(false);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [failures, setFailures] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  const phone = state.phone ?? "";

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const resend = async (forced: boolean) => {
    setCountdown(RESEND_SECONDS);
    setFailures(0);
    setMessage(forced ? ERROR_FORCED_RESEND : null);
    await verifyStart({ phone });
  };

  const handleComplete = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    setMessage(null);
    const result = await verifyCheck({ phone, code });
    setVerifying(false);
    if (result.ok && result.verified) {
      dispatch({ kind: "set_phone_verified" });
      dispatch({ kind: "next" });
      return;
    }
    const nextFailures = failures + 1;
    setFailures(nextFailures);
    setShakeNonce((n) => n + 1);
    if (result.ok && nextFailures >= MAX_FAILURES) {
      void resend(true);
    } else {
      setMessage(result.ok ? ERROR_WRONG : ERROR_NETWORK);
    }
  };

  return (
    <OnboardingScreen
      step={7}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      keyboardAvoiding
    >
      <ScreenHeader eyebrow="VERIFY" title="Enter the code" />
      <Text style={styles.sentTo}>Sent to {formatPhoneForDisplay(phone)}</Text>
      <View style={styles.body}>
        <CodeInput onComplete={(code) => void handleComplete(code)} shakeNonce={shakeNonce} disabled={verifying} />
        {message !== null ? <Text style={styles.errorText}>{message}</Text> : null}
        <View style={styles.resendRow}>
          {verifying ? (
            <ListeningDots />
          ) : countdown > 0 ? (
            <Text style={[type.meta, { color: text.faint }]}>Resend in {countdown}s</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend code"
              onPress={() => void resend(false)}
            >
              <Text style={type.meta}>
                Didn&apos;t get it?{" "}
                <Text style={{ color: gold.ink60 }}>Resend code</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sentTo: {
    ...type.meta,
    color: text.muted,
    paddingHorizontal: space.xxl,
    marginTop: 8,
  },
  body: {
    flex: 1,
    paddingTop: space.jumbo,
    paddingHorizontal: space.xl,
  },
  errorText: {
    ...type.meta,
    color: errorColor.message,
    textAlign: "center",
    marginTop: 16,
  },
  resendRow: {
    marginTop: 20,
    alignItems: "center",
    minHeight: 24,
    justifyContent: "center",
  },
});
