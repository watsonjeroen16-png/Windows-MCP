import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import TinyHuman from "../components/TinyHuman";
import StatBar from "../components/StatBar";
import { Action, PetState, level, mood, stage } from "../state/petLogic";
import { colors } from "../theme";

interface Props {
  pet: PetState;
  onAction: (action: Action) => void;
  onRescan: () => void;
}

const STAGE_LABEL = { baby: "Baby", kid: "Kid", adult: "Adult" } as const;

export default function HomeScreen({ pet, onAction, onRescan }: Props) {
  const insets = useSafeAreaInsets();
  const currentMood = mood(pet);
  const currentStage = stage(pet, Date.now());
  const asleep = pet.sleeping;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{pet.name}</Text>
          <Text style={styles.subline}>
            {STAGE_LABEL[currentStage]} · Lv {level(pet)}
          </Text>
        </View>
        <Pressable onPress={onRescan} hitSlop={8}>
          <Text style={styles.rescan}>🔄 Rescan face</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        {pet.faceUri && (
          <TinyHuman faceUri={pet.faceUri} mood={currentMood} stage={currentStage} />
        )}
      </View>

      <View style={styles.card}>
        <StatBar label="Fullness" emoji="🍙" value={pet.stats.fullness} />
        <StatBar label="Energy" emoji="⚡" value={pet.stats.energy} />
        <StatBar label="Happiness" emoji="💖" value={pet.stats.happiness} />
        <StatBar label="Hygiene" emoji="🫧" value={pet.stats.hygiene} />
      </View>

      <View style={styles.actions}>
        <ActionButton emoji="🍔" label="Feed" disabled={asleep} onPress={() => onAction("feed")} />
        <ActionButton
          emoji="🎾"
          label="Play"
          disabled={asleep || pet.stats.energy < 15}
          onPress={() => onAction("play")}
        />
        <ActionButton emoji="🛁" label="Wash" disabled={asleep} onPress={() => onAction("wash")} />
        <ActionButton
          emoji={asleep ? "☀️" : "😴"}
          label={asleep ? "Wake" : "Sleep"}
          onPress={() => onAction(asleep ? "wake" : "sleep")}
        />
      </View>
    </View>
  );
}

function ActionButton({
  emoji,
  label,
  onPress,
  disabled,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 28, fontWeight: "800", color: colors.ink },
  subline: { fontSize: 14, fontWeight: "600", color: colors.muted, marginTop: 2 },
  rescan: { fontSize: 13, fontWeight: "600", color: colors.accent },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  actionPressed: { transform: [{ scale: 0.95 }], backgroundColor: colors.accentSoft },
  actionDisabled: { opacity: 0.4 },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontSize: 12, fontWeight: "700", color: colors.ink },
});
