import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

interface Props {
  label: string;
  emoji: string;
  value: number;
}

export default function StatBar({ label, emoji, value }: Props) {
  const color = value < 30 ? colors.bad : value < 60 ? colors.warn : colors.good;
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.meta}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(value)}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 20, width: 26, textAlign: "center" },
  meta: { flex: 1, gap: 3 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(61,44,58,0.08)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 5 },
});
