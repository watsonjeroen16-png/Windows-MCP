/**
 * Screen 8c — Handoff confirmation, the bridge from onboarding into the
 * living World (app-restructure-v3.md; mockup: verify success replaces the
 * code entry in-place with this confirmation, then `go('home')`s after a
 * beat — see kaizi_v3_mockup.html's obVerifyCheck/finishVerify). The
 * relationship continues over SMS *and* the app now has a real home.
 *
 * On mount the onboarding state is committed immediately (profile POST, then
 * the first companion SMS is enqueued, then a fire-and-forget quiz
 * submission) with no further user action, then `onEnterWorld` fires after a
 * short beat so the ritual reads before the world opens.
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { sendWelcomeSms, submitProfile, submitQuizAnswers } from "../api/client";
import { companionById } from "../data/companions";
import { useOnboarding } from "../state/OnboardingContext";
import { ChatBubble } from "../ui/ChatBubble";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { CompanionVoice } from "../ui/CompanionVoice";
import { ListeningDots } from "../ui/ListeningDots";
import { OnboardingScreen } from "../ui/OnboardingScreen";
import { GlowOrb } from "../ui/ZenBackground";
import { font, gold, hue, line, mist, radius, space, text, type } from "../ui/tokens";

const VOICE_LINE = "I'll text you shortly. When I do — answer honestly.";

function CheckRow({ label }: { label: string }) {
  return (
    <View style={styles.checkRow}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path
          d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
          stroke={gold.icon90}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[type.meta, { color: text.muted }]}>{label}</Text>
    </View>
  );
}

const ENTER_WORLD_DELAY_MS = 2400;

export function HandoffScreen({ onEnterWorld }: { onEnterWorld: () => void }) {
  const { state } = useOnboarding();
  const committed = useRef(false);

  const companion = state.companion !== null ? companionById(state.companion) : null;

  // Beat before the world opens (mirrors the mockup's 2.4s handoff pause).
  useEffect(() => {
    const timer = setTimeout(onEnterWorld, ENTER_WORLD_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commit immediately on reaching 8c — profile first, then the welcome SMS.
  useEffect(() => {
    if (committed.current) return;
    committed.current = true;
    const { phone, companion: companionId, personality, environment, sessionToken } = state;
    if (!phone || !companionId || !personality || !environment || !sessionToken) return;
    void (async () => {
      const profile = await submitProfile(
        {
          goals: state.goals,
          identityWhy: state.identityWhy.trim(),
          companion: companionId,
          personality,
          environment,
          smsPrefs: state.smsPrefs,
        },
        sessionToken
      );
      if (profile.ok) {
        await sendWelcomeSms(sessionToken);
      }
      // Fire-and-forget: quiz submission never blocks/fails onboarding
      // (personalization-spec.md — the quiz is fully skippable by design).
      // See api/client.ts submitQuizAnswers doc comment: the backend route
      // may not be mounted yet, in which case this simply no-ops server-side.
      void submitQuizAnswers(
        { answers: state.quizAnswers, skippedEntirely: state.quizSkipped },
        sessionToken
      );
    })();
    // Intentionally run once with the state present at handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingScreen step={8} dotsComplete direction={state.direction}>
      <View style={styles.stack}>
        <View style={styles.avatarBlock}>
          <GlowOrb size={220} style={styles.orb} />
          <CompanionAvatar species={state.companion ?? "neutral"} size={146} />
        </View>
        <Text style={styles.title}>
          Your {companion?.name ?? "companion"} is on their way
        </Text>
        <ChatBubble role="companion" style={styles.bubble}>
          <CompanionVoice size={16}>{VOICE_LINE}</CompanionVoice>
        </ChatBubble>
        <View style={styles.confirmCard}>
          <CheckRow label="Number verified" />
          <CheckRow label={`Morning plan ${state.smsPrefs.morning ? "on" : "off"}`} />
          <CheckRow label={`Evening check-in ${state.smsPrefs.evening ? "on" : "off"}`} />
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.statusLine}>KEEP YOUR PHONE CLOSE</Text>
        <ListeningDots />
        <Text style={[type.subSerif, styles.microcopy]}>
          Every promise shapes who you&apos;re becoming
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxxl,
  },
  avatarBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    position: "absolute",
  },
  title: {
    fontFamily: font.serifLight,
    fontSize: 26,
    lineHeight: 33,
    color: hue.cream,
    textAlign: "center",
    marginTop: 20,
  },
  bubble: {
    marginTop: 18,
  },
  confirmCard: {
    alignSelf: "stretch",
    marginTop: 22,
    backgroundColor: mist[5],
    borderColor: line[8],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: space.xxxl,
    paddingBottom: 56,
    gap: 14,
  },
  statusLine: {
    ...type.buttonSm,
    color: text.muted,
  },
  microcopy: {
    textAlign: "center",
  },
});
