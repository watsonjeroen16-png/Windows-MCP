/**
 * You — merges Journey + Identity into one tabbed, deliberate-visit
 * destination (app-restructure-v3.md section 3): Progress / Companion /
 * Settings segmented tabs instead of three separate nav items.
 *
 * Progress is intentionally modest: the only real data available today is
 * today's intentions (GET /api/intentions) — there is no dedicated stats
 * endpoint (consistency %, total Growth, monthly chart) in the backend
 * surface this round, so this screen shows what's real and says plainly
 * what isn't built yet rather than fabricating numbers. Flagged in the
 * final report.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getIntentions, updateCustomization, type Intention } from "../api/client";
import { COMPANIONS } from "../data/companions";
import { ENVIRONMENTS } from "../data/environments";
import { PERSONALITIES } from "../data/personalities";
import { BackChevron } from "../ui/BackChevron";
import { Chip } from "../ui/Chip";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { GlassCard } from "../ui/GlassCard";
import { GoldButton } from "../ui/GoldButton";
import { MicroLabel } from "../ui/MicroLabel";
import { font, gold, hue, line, radius, space, text, type } from "../ui/tokens";
import { useWorld, type YouTab } from "../state/WorldContext";

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active ? styles.tabActive : null]}
    >
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ProgressPanel() {
  const { state } = useWorld();
  const [intentions, setIntentions] = useState<Intention[] | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getIntentions(state.identity.sessionToken);
      if (result !== null) setIntentions(result.intentions);
    })();
  }, [state.identity.sessionToken]);

  const kept = intentions?.filter((i) => i.status === "kept").length ?? 0;
  const total = intentions?.length ?? 0;

  return (
    <View>
      <View style={styles.statRow}>
        <GlassCard variant="standard" style={styles.statCard}>
          <MicroLabel>Today, kept</MicroLabel>
          <Text style={styles.statValue}>{intentions === null ? "—" : `${kept}/${total}`}</Text>
        </GlassCard>
        <GlassCard variant="standard" style={styles.statCard}>
          <MicroLabel>Active goals</MicroLabel>
          <Text style={styles.statValue}>{state.identity.goals.length}</Text>
        </GlassCard>
      </View>
      <GlassCard variant="subtle" style={styles.noteCard}>
        <Text style={styles.noteText}>
          Consistency %, total Growth, and the monthly chart need a dedicated stats endpoint that
          isn&apos;t built yet — this panel only shows what the live API can answer today.
        </Text>
      </GlassCard>
    </View>
  );
}

function CompanionPanel() {
  const { state, dispatch } = useWorld();
  const [companion, setCompanion] = useState(state.companion);
  const [personality, setPersonality] = useState(state.personality);
  const [environment, setEnvironment] = useState(state.environment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCompanion(state.companion);
    setPersonality(state.personality);
    setEnvironment(state.environment);
  }, [state.companion, state.personality, state.environment]);

  const dirty =
    companion !== state.companion || personality !== state.personality || environment !== state.environment;

  const handleSave = () => {
    if (!dirty || saving) return;
    setSaving(true);
    void (async () => {
      const result = await updateCustomization(
        { companionSpecies: companion, personality, environment },
        state.identity.sessionToken
      );
      setSaving(false);
      if (result !== null) {
        dispatch({
          kind: "set_customization",
          companion: result.companion_species,
          personality: result.personality,
          environment: result.environment,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      }
    })();
  };

  return (
    <View>
      <View style={styles.previewRow}>
        <CompanionAvatar species={companion} size={64} />
      </View>

      <MicroLabel style={styles.groupLabel}>Appearance</MicroLabel>
      <View style={styles.chipWrap}>
        {COMPANIONS.map((c) => (
          <Chip key={c.id} label={c.name} selected={companion === c.id} onPress={() => setCompanion(c.id)} />
        ))}
      </View>

      <MicroLabel style={styles.groupLabel}>Personality</MicroLabel>
      <View style={styles.chipWrap}>
        {PERSONALITIES.map((p) => (
          <Chip key={p.id} label={p.name} selected={personality === p.id} onPress={() => setPersonality(p.id)} />
        ))}
      </View>

      <MicroLabel style={styles.groupLabel}>World</MicroLabel>
      <View style={styles.chipWrap}>
        {ENVIRONMENTS.map((e) => (
          <Chip key={e.id} label={e.name} selected={environment === e.id} onPress={() => setEnvironment(e.id)} />
        ))}
      </View>

      <View style={styles.saveWrap}>
        <GoldButton
          label={saved ? "SAVED" : saving ? "SAVING…" : "SAVE CHANGES"}
          variant={dirty ? "emphatic" : "quiet"}
          disabled={!dirty || saving}
          onPress={handleSave}
        />
      </View>
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      {value !== undefined ? <Text style={styles.settingsValue}>{value}</Text> : null}
    </View>
  );
}

function SettingsPanel() {
  return (
    <GlassCard variant="subtle" style={styles.settingsCard}>
      <SettingsRow label="Subscription" value="Free" />
      <SettingsRow label="Notifications" value="Morning + Evening" />
      <SettingsRow label="Export data" />
      <SettingsRow label="Reset memory" />
      <Text style={styles.settingsNote}>
        These rows are informational for now — export/reset/subscription-management endpoints aren&apos;t
        built yet.
      </Text>
    </GlassCard>
  );
}

export function YouScreen() {
  const { state, dispatch } = useWorld();
  const insets = useSafeAreaInsets();

  const tabs: { id: YouTab; label: string }[] = [
    { id: "progress", label: "Progress" },
    { id: "companion", label: "Companion" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackChevron onPress={() => dispatch({ kind: "navigate", screen: "world" })} />
        <Text style={styles.headerTitle}>You</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            label={t.label}
            active={state.youTab === t.id}
            onPress={() => dispatch({ kind: "set_you_tab", tab: t.id })}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 12) + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {state.youTab === "progress" ? <ProgressPanel /> : null}
        {state.youTab === "companion" ? <CompanionPanel /> : null}
        {state.youTab === "settings" ? <SettingsPanel /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0A08",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingTop: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: font.serifLight,
    fontSize: 20,
    color: hue.cream,
    textAlign: "center",
  },
  headerSpacer: {
    width: 36,
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: space.xl,
    paddingVertical: 14,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: gold.fill12,
    borderColor: gold.line25,
  },
  tabLabel: {
    ...type.buttonSm,
    color: text.faint,
  },
  tabLabelActive: {
    color: gold.solid,
  },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: 60,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
  },
  statValue: {
    fontFamily: font.serifLight,
    fontSize: 28,
    color: hue.cream,
    marginTop: 6,
  },
  noteCard: {
    padding: 14,
  },
  noteText: {
    ...type.meta,
    color: text.faint,
    lineHeight: 17,
  },
  previewRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  groupLabel: {
    marginTop: 14,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  saveWrap: {
    marginTop: 24,
  },
  settingsCard: {
    padding: 0,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line[5],
  },
  settingsLabel: {
    flex: 1,
    fontSize: 13,
    color: text.body,
  },
  settingsValue: {
    fontFamily: font.serifLight,
    fontSize: 13,
    color: gold.solid,
  },
  settingsNote: {
    ...type.meta,
    color: text.faint,
    padding: 16,
    lineHeight: 16,
  },
});
