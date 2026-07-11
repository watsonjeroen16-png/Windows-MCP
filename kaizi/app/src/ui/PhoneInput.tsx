/**
 * PhoneInput — screen 7a. Pill field: country-code selector (flag + dial,
 * opens a glassHeavy bottom-sheet list with search) | hairline divider |
 * phone-pad number field with light as-you-type grouping.
 *
 * The stored/submitted value is always E.164 (dial + national digits);
 * the visual grouping is cosmetic and never trusted. Validation is the
 * shared ^\+[1-9]\d{6,14}$ check in OnboardingContext (isValidE164) — a
 * deliberate lightweight stand-in for libphonenumber (see README).
 */
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { COUNTRIES, type Country } from "../data/countries";
import { MicroLabel } from "./MicroLabel";
import { error as errorColor, hue, line, mist, misc, radius, text, type } from "./tokens";

interface PhoneInputProps {
  country: Country;
  /** National number, digits only. */
  national: string;
  onChangeCountry: (country: Country) => void;
  onChangeNational: (digits: string) => void;
  errorMessage?: string | null;
}

/** Light national grouping: +1 gets (XXX) XXX-XXXX, others space-groups. */
export function formatNational(digits: string, dial: string): string {
  if (dial === "+1") {
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);
    if (digits.length <= 3) return a;
    if (digits.length <= 6) return `(${a}) ${b}`;
    return `(${a}) ${b}-${c}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

function ChevronDown() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M2.5 4.5 L6 8 L9.5 4.5"
        stroke={text.faint}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PhoneInput({
  country,
  national,
  onChangeCountry,
  onChangeNational,
  errorMessage,
}: PhoneInputProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/^\+?/, "+")),
    );
  }, [query]);

  const handleDigits = (raw: string) => {
    let digits = raw.replace(/\D/g, "");
    // Users habitually type the national trunk prefix ("0612…"), which would
    // yield a non-dialable E.164 like +3106… — strip leading zeros. Italy is
    // the known exception (landlines keep the 0), but this field collects
    // mobile numbers and Italian mobiles never start with 0.
    if (country.dial !== "+39") digits = digits.replace(/^0+/, "");
    onChangeNational(digits.slice(0, 14));
  };

  return (
    <View>
      <MicroLabel style={styles.fieldLabel}>MOBILE NUMBER</MicroLabel>
      <View
        style={[styles.pill, errorMessage ? { borderColor: errorColor.border } : null]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country: ${country.name} ${country.dial}`}
          onPress={() => setSheetOpen(true)}
          style={styles.countryButton}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={[type.bodySans, styles.dial]}>{country.dial}</Text>
          <ChevronDown />
        </Pressable>
        <View style={styles.divider} />
        <TextInput
          style={[type.bodySans, styles.numberField]}
          keyboardType="phone-pad"
          value={formatNational(national, country.dial)}
          onChangeText={handleDigits}
          placeholder="(555) 123-4567"
          placeholderTextColor={text.faint}
          maxLength={20}
          accessibilityLabel="Mobile number"
        />
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <MicroLabel style={styles.sheetTitle}>CHOOSE COUNTRY</MicroLabel>
          <TextInput
            style={[type.bodySans, styles.searchField]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search countries"
            placeholderTextColor={text.faint}
            accessibilityLabel="Search countries"
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChangeCountry(item);
                  setSheetOpen(false);
                  setQuery("");
                }}
                style={styles.countryRow}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={[type.bodySans, styles.countryName]}>{item.name}</Text>
                <Text style={[type.bodySans, { color: text.muted }]}>{item.dial}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    marginBottom: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mist[5],
    borderColor: line[12],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flag: {
    fontSize: 16,
  },
  dial: {
    color: hue.cream,
    fontSize: 16,
    lineHeight: 20,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: line[10],
    marginHorizontal: 12,
  },
  numberField: {
    flex: 1,
    color: hue.cream,
    fontSize: 16,
    lineHeight: 20,
    padding: 0,
  },
  errorText: {
    ...type.meta,
    color: errorColor.message,
    marginTop: 8,
    marginLeft: 20,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: misc.scrimSheet,
    borderColor: line[10],
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: 14,
  },
  searchField: {
    backgroundColor: mist[5],
    borderColor: line[10],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    color: hue.cream,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line[5],
  },
  countryName: {
    flex: 1,
    color: hue.cream,
  },
});
