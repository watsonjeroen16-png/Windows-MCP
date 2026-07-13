/**
 * Reflection sheet — was the standalone Reflection screen, now surfaced
 * contextually (the Reflect pill on World) instead of a nav item
 * (app-restructure-v3.md section 3). Wired to `GET/POST /api/journal`
 * (world-build-plan.md).
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createJournalEntry } from "../api/client";
import { GlassCard } from "../ui/GlassCard";
import { MicroLabel } from "../ui/MicroLabel";
import { Sheet } from "../ui/Sheet";
import { font, gold, hue, line, mist, radius, text, type } from "../ui/tokens";
import { useWorld } from "../state/WorldContext";

interface ReflectionSheetProps {
  visible: boolean;
  onClose: () => void;
  kept: number;
  missed: number;
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function ReflectionSheet({ visible, onClose, kept, missed }: ReflectionSheetProps) {
  const { state, dispatch } = useWorld();
  const [entry, setEntry] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEntry("");
      setSaved(false);
    }
  }, [visible]);

  const companionLine =
    kept > 0
      ? `${kept} ${kept === 1 ? "intention" : "intentions"} kept. You did what you said you'd do — the garden remembers.`
      : "Today's still open. Whatever you do next still counts.";

  const handleSave = () => {
    const content = entry.trim();
    if (content.length === 0 || saving) return;
    setSaving(true);
    void (async () => {
      const result = await createJournalEntry(content, state.identity.sessionToken);
      setSaving(false);
      if (result !== null) setSaved(true);
    })();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.heading}>Today&apos;s reflection</Text>
      <Text style={styles.date}>{todayLabel()}</Text>

      <View style={styles.statsRow}>
        <GlassCard variant="standard" style={styles.statCard}>
          <Text style={styles.statValue}>{kept}</Text>
          <MicroLabel style={styles.statLabel}>Kept</MicroLabel>
        </GlassCard>
        <GlassCard variant="standard" style={styles.statCard}>
          <Text style={[styles.statValue, styles.statValueMuted]}>{missed}</Text>
          <MicroLabel style={styles.statLabel}>Missed</MicroLabel>
        </GlassCard>
      </View>

      <GlassCard variant="standard" style={styles.companionCard}>
        <MicroLabel>From your companion</MicroLabel>
        <Text style={styles.companionLine}>&ldquo;{companionLine}&rdquo;</Text>
      </GlassCard>

      <MicroLabel style={styles.journalLabel}>Journal</MicroLabel>
      <TextInput
        style={styles.textarea}
        value={entry}
        onChangeText={setEntry}
        placeholder="What does today mean to you?"
        placeholderTextColor={text.faint}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryAction, entry.trim().length === 0 || saving ? styles.actionDisabled : null]}
          onPress={handleSave}
          disabled={entry.trim().length === 0 || saving}
        >
          <Text style={styles.primaryActionLabel}>
            {saved ? "Saved" : saving ? "Saving…" : "Save reflection"}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={onClose}>
          <Text style={styles.secondaryActionLabel}>Return to the garden</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() => {
            onClose();
            dispatch({ kind: "open_sheet", sheet: "intentions" });
          }}
        >
          <Text style={styles.secondaryActionLabel}>Review tomorrow&apos;s intentions</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: font.serifLight,
    fontSize: 22,
    color: hue.cream,
    marginBottom: 3,
  },
  date: {
    fontFamily: font.serifLightItalic,
    fontSize: 12.5,
    color: text.muted,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  statValue: {
    fontFamily: font.serifLight,
    fontSize: 24,
    color: hue.cream,
  },
  statValueMuted: {
    color: text.faint,
  },
  statLabel: {
    marginTop: 3,
  },
  companionCard: {
    marginBottom: 14,
  },
  companionLine: {
    fontFamily: font.serifLightItalic,
    fontSize: 14.5,
    color: hue.cream,
    lineHeight: 22,
    marginTop: 8,
  },
  journalLabel: {
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    height: 90,
    backgroundColor: mist[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
    borderRadius: radius.lg,
    padding: 13,
    ...type.bodySans,
    lineHeight: 20,
  },
  footer: {
    marginTop: 14,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: gold.fill10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gold.line22,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionDisabled: {
    opacity: 0.5,
  },
  primaryActionLabel: {
    ...type.buttonSm,
    color: gold.solid,
  },
  secondaryAction: {
    backgroundColor: mist[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[8],
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryActionLabel: {
    ...type.buttonSm,
    color: text.faint,
  },
});
