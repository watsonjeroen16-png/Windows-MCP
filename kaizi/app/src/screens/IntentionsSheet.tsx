/**
 * Intentions sheet — was the standalone Promises screen (onboarding-spec.md
 * precedent), now a contextual overlay on the World (app-restructure-v3.md
 * section 3). Wired to the real `GET/POST /api/intentions` and
 * `POST /api/intentions/:id/keep` (world-build-plan.md); the "Yours today"
 * section is this round's new manual "add your own intention" affordance.
 *
 * Source note: `kaizi/server/src/routes/intentions.ts`'s createIntentionSchema
 * doesn't accept a `source` field yet (checked against the live file — the
 * backend agent's migration adds the DB column with `DEFAULT 'user'`, but the
 * route itself doesn't expose it as a request field, and `IntentionRow`
 * already types `source` on the response). That default is exactly what this
 * screen needs — every intention created here lands as `source: 'user'`
 * without the client having to say so — so "Yours today" filters on
 * `intention.source === 'user'` (falling back to `true` if `source` is ever
 * absent from an API response, so the section still renders sensibly against
 * an older server).
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createIntention, keepIntention, type Intention } from "../api/client";
import { GlassCard } from "../ui/GlassCard";
import { GoldButton } from "../ui/GoldButton";
import { MicroLabel } from "../ui/MicroLabel";
import { Sheet } from "../ui/Sheet";
import { font, gold, hue, line, mist, radius, text, type } from "../ui/tokens";
import { useWorld } from "../state/WorldContext";

interface IntentionsSheetProps {
  visible: boolean;
  onClose: () => void;
  intentions: Intention[] | null;
  onChanged: () => void;
}

const DEFAULT_MANUAL_REWARD = 20;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IntentionsSheet({ visible, onClose, intentions, onChanged }: IntentionsSheetProps) {
  const { state } = useWorld();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keeping, setKeeping] = useState(false);

  const list = intentions ?? [];
  const kept = list.filter((i) => i.status === "kept").length;
  const pending = list.filter((i) => i.status === "pending" && !dismissed.has(i.id));
  const current = pending[0] ?? null;
  const yours = list.filter((i) => (i.source ?? "user") === "user");

  const handleKeep = () => {
    if (current === null || keeping) return;
    setKeeping(true);
    void (async () => {
      const result = await keepIntention(current.id, state.identity.sessionToken);
      setKeeping(false);
      if (result !== null) onChanged();
    })();
  };

  const handleRemindLater = () => {
    if (current === null) return;
    // No "snooze" endpoint exists server-side yet — this only reorders the
    // local queue so the next pending intention surfaces; it doesn't persist.
    setDismissed((prev) => new Set(prev).add(current.id));
  };

  const handleAddIntention = () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0 || submitting) return;
    setSubmitting(true);
    void (async () => {
      const created = await createIntention(
        {
          title: trimmedTitle,
          subtitle: note.trim().length > 0 ? note.trim() : undefined,
          rewardGrowth: DEFAULT_MANUAL_REWARD,
          scheduledFor: todayIsoDate(),
        },
        state.identity.sessionToken
      );
      setSubmitting(false);
      if (created !== null) {
        setTitle("");
        setNote("");
        setShowAddForm(false);
        onChanged();
      }
    })();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Today&apos;s intentions</Text>
        <Text style={styles.count}>
          {kept} of {list.length}
        </Text>
      </View>
      <Text style={styles.tagline}>Keeping one shapes the world you&apos;re standing in.</Text>

      {current !== null ? (
        <>
          <GlassCard variant="standard" style={styles.card}>
            <MicroLabel tone="gold">
              Intention {list.indexOf(current) + 1} of {list.length}
            </MicroLabel>
            <Text style={styles.cardTitle}>{current.title}</Text>
            {current.subtitle !== null ? <Text style={styles.cardSub}>{current.subtitle}</Text> : null}
            <View style={styles.cardFooter}>
              <Text style={styles.rewardLabel}>Reward</Text>
              <Text style={styles.rewardValue}>+{current.reward_growth} Growth</Text>
            </View>
          </GlassCard>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionGhost} onPress={handleRemindLater}>
              <Text style={styles.actionGhostLabel}>Remind later</Text>
            </Pressable>
            <Pressable style={styles.actionGold} onPress={handleKeep} disabled={keeping}>
              <Text style={styles.actionGoldLabel}>{keeping ? "Keeping…" : "Intention kept"}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.emptyState}>
          {list.length === 0 ? "Nothing scheduled yet — add one below." : "Everything's kept for today."}
        </Text>
      )}

      <MicroLabel style={styles.sectionLabel}>Yours today</MicroLabel>
      {yours.length === 0 ? (
        <Text style={styles.emptySmall}>Nothing you&apos;ve added yet.</Text>
      ) : (
        <View style={styles.list}>
          {yours.map((i) => (
            <View key={i.id} style={styles.listRow}>
              <View style={[styles.statusDot, i.status === "kept" ? styles.statusDotKept : null]} />
              <Text style={[styles.listTitle, i.status === "kept" ? styles.listTitleKept : null]}>
                {i.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showAddForm ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.addInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Name your intention"
            placeholderTextColor={text.faint}
            maxLength={60}
            returnKeyType="next"
          />
          <TextInput
            style={styles.addInput}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={text.faint}
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={handleAddIntention}
          />
          <View style={styles.addActions}>
            <Pressable
              style={styles.addCancel}
              onPress={() => {
                setShowAddForm(false);
                setTitle("");
                setNote("");
              }}
            >
              <Text style={styles.addCancelLabel}>Cancel</Text>
            </Pressable>
            <View style={styles.addConfirmWrap}>
              <GoldButton
                label={submitting ? "Adding…" : "Add to today"}
                variant="quiet"
                disabled={title.trim().length === 0 || submitting}
                onPress={handleAddIntention}
              />
            </View>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addRow} onPress={() => setShowAddForm(true)}>
          <Text style={styles.addRowPlus}>+</Text>
          <Text style={styles.addRowLabel}>Add your own</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heading: {
    fontFamily: font.serifLight,
    fontSize: 22,
    color: hue.cream,
  },
  count: {
    ...type.meta,
    color: gold.ink60,
  },
  tagline: {
    fontFamily: font.serifLightItalic,
    fontSize: 12.5,
    color: hue.sand,
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: font.serifLight,
    fontSize: 26,
    color: hue.cream,
    marginTop: 12,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: font.serifLightItalic,
    fontSize: 14,
    color: hue.sand,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line[8],
  },
  rewardLabel: {
    fontSize: 12,
    color: text.muted,
  },
  rewardValue: {
    fontFamily: font.serifRegular,
    fontSize: 16,
    color: gold.solid,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  actionGhost: {
    flex: 1,
    backgroundColor: mist[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: "center",
  },
  actionGhostLabel: {
    ...type.meta,
    color: text.faint,
  },
  actionGold: {
    flex: 1,
    backgroundColor: gold.fill12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gold.line25,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: "center",
  },
  actionGoldLabel: {
    ...type.meta,
    color: gold.solid,
  },
  emptyState: {
    fontFamily: font.serifLightItalic,
    fontSize: 14,
    color: text.faint,
    textAlign: "center",
    paddingVertical: 20,
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
  },
  emptySmall: {
    ...type.meta,
    color: text.faint,
    marginBottom: 8,
  },
  list: {
    gap: 6,
    marginBottom: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: mist[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[8],
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: text.trace,
  },
  statusDotKept: {
    backgroundColor: gold.solid,
  },
  listTitle: {
    fontFamily: font.serifLight,
    fontSize: 14,
    color: hue.cream,
  },
  listTitleKept: {
    color: text.muted,
    textDecorationLine: "line-through",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
  },
  addRowPlus: {
    color: gold.solid,
    fontSize: 16,
  },
  addRowLabel: {
    ...type.meta,
    color: gold.ink60,
  },
  addForm: {
    marginTop: 10,
    gap: 8,
  },
  addInput: {
    backgroundColor: mist[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...type.bodySans,
  },
  addActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  addCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[8],
  },
  addCancelLabel: {
    ...type.meta,
    color: text.faint,
  },
  addConfirmWrap: {
    flex: 2,
  },
});
