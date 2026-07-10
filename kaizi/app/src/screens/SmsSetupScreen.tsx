/**
 * Screen 7a — SMS Setup. Collects the phone number (E.164, the only contact
 * detail in the product) and the morning/evening SMS preferences, then asks
 * the backend to send a verification code.
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { verifyStart } from "../api/client";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "../data/countries";
import { isValidE164, useOnboarding, type SmsPrefs } from "../state/OnboardingContext";
import { GoldButton } from "../ui/GoldButton";
import { OnboardingScreen, ScreenHeader } from "../ui/OnboardingScreen";
import { PhoneInput } from "../ui/PhoneInput";
import { Toggle } from "../ui/Toggle";
import { font, hue, line, mist, radius, space, text, type } from "../ui/tokens";

const ERROR_INVALID = "That number doesn't look right. Check the country code?";
const ERROR_NETWORK = "We couldn't send the code. Try again in a moment.";

/** Recover country + national digits from a stored E.164 value (back nav). */
function splitE164(phone: string | null): { country: Country; national: string } {
  if (phone) {
    // Longest dial code first so +358 wins over +35.
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => phone.startsWith(c.dial));
    if (match) return { country: match, national: phone.slice(match.dial.length) };
  }
  return { country: DEFAULT_COUNTRY, national: "" };
}

function PrefRow({
  label,
  subLabel,
  value,
  onChange,
  divider,
}: {
  label: string;
  subLabel: string;
  value: boolean;
  onChange: (value: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.prefRow, divider ? styles.prefRowDivider : null]}>
      <View style={styles.prefText}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefSubLabel}>{subLabel}</Text>
      </View>
      <Toggle value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

export function SmsSetupScreen() {
  const { state, dispatch } = useOnboarding();
  const initial = splitE164(state.phone);
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState<string>(initial.national);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const e164 = `${country.dial}${national}`;
  const valid = isValidE164(e164);

  const setPref = (pref: keyof SmsPrefs) => (value: boolean) =>
    dispatch({ kind: "set_sms_pref", pref, value });

  const handleSendCode = async () => {
    if (sending) return;
    if (!valid) {
      setErrorMessage(ERROR_INVALID);
      return;
    }
    setErrorMessage(null);
    setSending(true);
    const result = await verifyStart({ phone: e164 });
    setSending(false);
    if (result.ok) {
      dispatch({ kind: "set_phone", phone: e164 });
      dispatch({ kind: "next" });
    } else {
      setErrorMessage(ERROR_NETWORK);
    }
  };

  return (
    <OnboardingScreen
      step={7}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      keyboardAvoiding
      cta={
        <GoldButton
          label={sending ? "SENDING…" : "SEND CODE"}
          variant="quiet"
          disabled={!valid || sending}
          onPress={() => {
            void handleSendCode();
          }}
        />
      }
      microcopy="Your number is used only for your companion's messages. Never shared."
    >
      <ScreenHeader
        eyebrow="STAY CONNECTED"
        title="One last promise"
        subtitle="Your companion checks in by text. No email, no spam — just them."
      />
      <View style={styles.body}>
        <PhoneInput
          country={country}
          national={national}
          onChangeCountry={(next) => {
            setCountry(next);
            setErrorMessage(null);
          }}
          onChangeNational={(digits) => {
            setNational(digits);
            setErrorMessage(null);
          }}
          errorMessage={errorMessage}
        />
        <View style={styles.prefCard}>
          <PrefRow
            label="Morning plan"
            subLabel="A text to start your day with intention"
            value={state.smsPrefs.morning}
            onChange={setPref("morning")}
          />
          <PrefRow
            label="Evening check-in"
            subLabel="A moment to close the day honestly"
            value={state.smsPrefs.evening}
            onChange={setPref("evening")}
            divider
          />
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
  },
  prefCard: {
    marginTop: 20,
    backgroundColor: mist[5],
    borderColor: line[8],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingHorizontal: 18,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  prefRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line[5],
  },
  prefText: {
    flex: 1,
    paddingRight: 12,
  },
  prefLabel: {
    fontFamily: font.serifLight,
    fontSize: 15,
    lineHeight: 20,
    color: hue.cream,
  },
  prefSubLabel: {
    ...type.meta,
    color: text.faint,
    marginTop: 2,
  },
});
