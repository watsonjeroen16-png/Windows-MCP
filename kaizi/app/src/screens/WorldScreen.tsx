/**
 * World — the app's only home post-onboarding (app-restructure-v3.md
 * section 3). Always-on companion + zone travel strip; Intentions,
 * Reflection, and Chat are contextual sheets layered on top, not separate
 * screens. Reuses the same CompanionAvatar/idle-motion already built for
 * onboarding (src/ui/CompanionAvatar.tsx) rather than a second rig.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { generateIntentions, getIntentions, type Intention } from "../api/client";
import { companionById } from "../data/companions";
import { isZoneUnlocked, ZONES, zoneById } from "../data/zones";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { GlassCard } from "../ui/GlassCard";
import { useLoopValue } from "../ui/motion";
import { font, gold, hue, line, mist, radius, space, text, type } from "../ui/tokens";
import { ZoneBackground } from "../ui/ZoneBackground";
import { useWorld } from "../state/WorldContext";
import { ChatSheet } from "./ChatSheet";
import { IntentionsSheet } from "./IntentionsSheet";
import { ReflectionSheet } from "./ReflectionSheet";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good evening";
}

function WeatherIcon({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cycle weather" onPress={onPress} style={styles.iconChip}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,224,0.75)" strokeWidth={1.6}>
        <Path
          d="M17.5 19a4.5 4.5 0 000-9 6 6 0 00-11.4-1.5A4.5 4.5 0 007 19h10.5z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function ReflectDot() {
  const glow = useLoopValue(3000);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.5, 0.85]),
  }));
  return <Animated.View style={[styles.reflectDot, style]} />;
}

function YouChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="You" onPress={onPress} style={styles.iconChip}>
      <CompanionAvatar species="neutral" size={22} animated={false} />
    </Pressable>
  );
}

function ZoneChip({
  label,
  active,
  locked,
  onPress,
}: {
  label: string;
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: false }}
      onPress={onPress}
      style={[
        styles.zoneChip,
        active ? styles.zoneChipActive : null,
        locked ? styles.zoneChipLocked : null,
      ]}
    >
      <Text style={[type.tab, { color: active ? hue.sand : text.faint }]}>{label}</Text>
      {locked ? (
        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,224,0.5)" strokeWidth={2} style={styles.lockIcon}>
          <Path d="M4 11 h16 v9 a2 2 0 01-2 2 H6 a2 2 0 01-2-2 z" />
          <Path d="M8 11 V7 a4 4 0 018 0 v4" />
        </Svg>
      ) : null}
    </Pressable>
  );
}

export function WorldScreen() {
  const { state, dispatch } = useWorld();
  const [intentions, setIntentions] = useState<Intention[] | null>(null);
  const [lockedHint, setLockedHint] = useState<string | null>(null);
  // Guards against calling /generate more than once per mount — a day with
  // zero intentions stays zero after a failed/empty generation attempt
  // rather than retrying on every re-render.
  const generateAttempted = useRef(false);

  const companionMeta = companionById(state.companion);
  const zoneMeta = zoneById(state.zone);
  const hour = new Date().getHours();

  const refreshIntentions = useCallback(() => {
    void (async () => {
      const result = await getIntentions(state.identity.sessionToken);
      if (result === null) return;
      if (result.intentions.length === 0 && !generateAttempted.current) {
        // Empty day — ask the companion to generate personalized intentions
        // (routes/intentions.ts's own doc comment names this exact moment as
        // the intended call site) rather than leaving the world empty.
        generateAttempted.current = true;
        const generated = await generateIntentions(state.identity.sessionToken);
        setIntentions(generated?.intentions ?? result.intentions);
        return;
      }
      setIntentions(result.intentions);
    })();
  }, [state.identity.sessionToken]);

  useEffect(() => {
    refreshIntentions();
  }, [refreshIntentions, state.intentionsVersion]);

  useEffect(() => {
    if (lockedHint === null) return;
    const timer = setTimeout(() => setLockedHint(null), 2600);
    return () => clearTimeout(timer);
  }, [lockedHint]);

  const kept = intentions?.filter((i) => i.status === "kept").length ?? 0;
  const total = intentions?.length ?? 0;
  const nextPending = intentions?.find((i) => i.status === "pending") ?? null;

  const handleSelectZone = (id: typeof state.zone) => {
    const zone = zoneById(id);
    if (!isZoneUnlocked(zone, state.identity.goals)) {
      setLockedHint(zone.lockedHint);
      return;
    }
    dispatch({ kind: "select_zone", zone: id });
  };

  return (
    <View style={styles.root}>
      <ZoneBackground zone={state.zone} weather={state.weather} />

      <View style={styles.statusBar}>
        <Text style={styles.clock}>
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <View style={styles.statusRight}>
          <WeatherIcon onPress={() => dispatch({ kind: "cycle_weather" })} />
          <YouChip onPress={() => dispatch({ kind: "navigate", screen: "you" })} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.zoneStrip}
        contentContainerStyle={styles.zoneStripContent}
      >
        {ZONES.map((z) => (
          <ZoneChip
            key={z.id}
            label={z.label}
            active={state.zone === z.id}
            locked={!isZoneUnlocked(z, state.identity.goals)}
            onPress={() => handleSelectZone(z.id)}
          />
        ))}
      </ScrollView>
      <Text style={styles.zoneCaption}>{lockedHint ?? zoneMeta.caption}</Text>

      <View style={styles.greeting}>
        <Text style={styles.greetTitle}>{greetingForHour(hour)}</Text>
        <Text style={styles.greetSub}>
          {companionMeta.name} is in {zoneMeta.label.replace(/^The /, "the ")}
        </Text>
      </View>

      <View style={styles.companionSlot} pointerEvents="none">
        <CompanionAvatar species={state.companion} size={130} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open chat"
        onPress={() => dispatch({ kind: "open_sheet", sheet: "chat" })}
        style={styles.chatFab}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,224,0.85)" strokeWidth={1.6}>
          <Path
            d="M21 11.5a8.38 8.38 0 01-9 8.4 8.5 8.5 0 01-3.4-.7L3 21l1.8-5.6a8.4 8.4 0 1116.2-3.9z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      <View style={styles.homeUi}>
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({ kind: "open_sheet", sheet: "reflection" })}
          style={styles.reflectPill}
        >
          <ReflectDot />
          <Text style={styles.reflectLabel}>Reflect on today</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({ kind: "open_sheet", sheet: "intentions" })}
        >
          <GlassCard variant="standard" style={styles.pouch}>
            <View style={styles.pouchRing}>
              <Text style={styles.pouchRingText}>
                {total > 0 ? `${kept}/${total}` : "—"}
              </Text>
            </View>
            <View style={styles.pouchTextBlock}>
              <Text style={styles.pouchTitle}>
                {total > 0 ? `${kept} of ${total} intentions kept` : "No intentions yet today"}
              </Text>
              <Text style={styles.pouchSub} numberOfLines={1}>
                {nextPending !== null ? `Next · ${nextPending.title}` : "Tap to add one"}
              </Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      <ChatSheet
        visible={state.sheet === "chat"}
        onClose={() => dispatch({ kind: "close_sheet" })}
        companionName={companionMeta.name}
      />
      <IntentionsSheet
        visible={state.sheet === "intentions"}
        onClose={() => dispatch({ kind: "close_sheet" })}
        intentions={intentions}
        onChanged={() => dispatch({ kind: "bump_intentions" })}
      />
      <ReflectionSheet
        visible={state.sheet === "reflection"}
        onClose={() => dispatch({ kind: "close_sheet" })}
        kept={kept}
        missed={Math.max(total - kept, 0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  statusBar: {
    height: 54,
    paddingHorizontal: 26,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clock: {
    ...type.bodySans,
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: hue.cream,
  },
  statusRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mist[7],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[14],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoneStrip: {
    marginTop: 8,
    flexGrow: 0,
  },
  zoneStripContent: {
    paddingHorizontal: space.xl,
    gap: 8,
  },
  zoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: mist[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[10],
  },
  zoneChipActive: {
    backgroundColor: gold.fill12,
    borderColor: gold.line25,
  },
  zoneChipLocked: {
    opacity: 0.6,
  },
  lockIcon: {
    marginLeft: 2,
  },
  zoneCaption: {
    ...type.meta,
    color: text.faint,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: space.xl,
  },
  greeting: {
    alignItems: "center",
    marginTop: 18,
  },
  greetTitle: {
    fontFamily: font.serifLight,
    fontSize: 26,
    color: hue.cream,
  },
  greetSub: {
    ...type.meta,
    color: text.faint,
    marginTop: 4,
  },
  companionSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatFab: {
    position: "absolute",
    right: space.xl,
    bottom: 168,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mist[7],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[14],
    alignItems: "center",
    justifyContent: "center",
  },
  homeUi: {
    paddingHorizontal: space.xl,
    paddingBottom: 40,
    gap: 10,
  },
  reflectPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: mist[7],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[14],
  },
  reflectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: gold.solid,
  },
  reflectLabel: {
    ...type.meta,
    color: hue.sand,
  },
  pouch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  pouchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: gold.line25,
    alignItems: "center",
    justifyContent: "center",
  },
  pouchRingText: {
    fontFamily: font.serifLight,
    fontSize: 13,
    color: hue.cream,
  },
  pouchTextBlock: {
    flex: 1,
  },
  pouchTitle: {
    fontFamily: font.serifLight,
    fontSize: 15,
    color: hue.cream,
  },
  pouchSub: {
    ...type.meta,
    color: gold.ink60,
    marginTop: 2,
  },
});
