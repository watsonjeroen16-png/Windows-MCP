/**
 * Step 4 — Personalization quiz (personalization-spec.md section 1). One
 * global onboarding step containing an internal 10-card sequence with its
 * own secondary progress indicator (QuizProgress) rather than 10 global
 * ProgressDots. Single-select chips auto-advance ~350ms after tap
 * (mirroring the mockup's Duolingo-style pacing); the one multi-select
 * question (Q5, availability) keeps an explicit Continue CTA. Every
 * question is individually skippable, and "Skip quiz" on card 1 exits the
 * whole step with zero answers recorded.
 */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { focusGoalOptions, QUIZ_LENGTH, QUIZ_QUESTIONS } from "../data/quiz";
import { useOnboarding } from "../state/OnboardingContext";
import { Chip } from "../ui/Chip";
import { GoldButton } from "../ui/GoldButton";
import { MicroLabel } from "../ui/MicroLabel";
import { OnboardingScreen } from "../ui/OnboardingScreen";
import { QuizProgress } from "../ui/QuizProgress";
import { SerifTitle } from "../ui/SerifTitle";
import { font, hue, space, text, type } from "../ui/tokens";

const FINISH_DELAY_MS = 900;
const AUTO_ADVANCE_DELAY_MS = 350;

export function QuizScreen() {
  const { state, dispatch } = useOnboarding();
  const [finishing, setFinishing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const question = QUIZ_QUESTIONS[state.quizIndex] ?? QUIZ_QUESTIONS[0]!;
  const options =
    question.key === "focusGoal" ? focusGoalOptions(state.goals) : (question.options ?? []);
  const answer = state.quizAnswers[question.key];
  const multiSelected = Array.isArray(answer) ? answer : [];
  const isFirstCard = state.quizIndex === 0;
  const isLastCard = state.quizIndex === QUIZ_LENGTH - 1;

  // Reset the finishing splash if the user somehow returns to a non-terminal
  // card (e.g. fast back-navigation racing the timer) — defensive only.
  useEffect(() => {
    if (!isLastCard) setFinishing(false);
  }, [isLastCard]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  const advance = () => {
    if (isLastCard) {
      setFinishing(true);
      schedule(() => dispatch({ kind: "next" }), FINISH_DELAY_MS);
      return;
    }
    dispatch({ kind: "next" });
  };

  const handleSingleSelect = (value: string) => {
    dispatch({ kind: "set_quiz_answer", key: question.key, value });
    schedule(advance, AUTO_ADVANCE_DELAY_MS);
  };

  const handleMultiToggle = (value: string) => {
    dispatch({ kind: "toggle_quiz_multi_answer", key: question.key, value });
  };

  const canContinueMulti = question.multi && multiSelected.length > 0;

  return (
    <OnboardingScreen
      step={4}
      direction={state.direction}
      onBack={() => dispatch({ kind: "back" })}
      topRight={
        isFirstCard && !finishing ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ kind: "skip_whole_quiz" })}
            hitSlop={8}
          >
            <Text style={styles.skipQuizLink}>Skip quiz</Text>
          </Pressable>
        ) : undefined
      }
      cta={
        question.multi && !finishing ? (
          <GoldButton
            label="CONTINUE"
            variant="quiet"
            disabled={!canContinueMulti}
            onPress={advance}
          />
        ) : undefined
      }
    >
      {finishing ? (
        <View style={styles.doneWrap}>
          <Text style={styles.doneLine}>&ldquo;Got it — that helps.&rdquo;</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <MicroLabel>{question.eyebrow}</MicroLabel>
            <QuizProgress current={state.quizIndex + 1} total={QUIZ_LENGTH} />
            <SerifTitle size="title" style={styles.title}>
              {question.title}
            </SerifTitle>
            {question.subtitle !== undefined ? (
              <Text style={styles.subtitle}>{question.subtitle}</Text>
            ) : null}
          </View>
          <View style={styles.chipField}>
            <View style={styles.chipRow}>
              {options.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={question.multi ? multiSelected.includes(opt.value) : answer === opt.value}
                  onPress={() =>
                    question.multi ? handleMultiToggle(opt.value) : handleSingleSelect(opt.value)
                  }
                />
              ))}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={advance}
            style={styles.skipQWrap}
            hitSlop={8}
          >
            <Text style={styles.skipQLink}>Skip this question</Text>
          </Pressable>
        </>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingHorizontal: space.xxl,
  },
  title: {
    marginTop: 14,
  },
  subtitle: {
    fontFamily: font.serifLightItalic,
    fontSize: 13,
    lineHeight: 18,
    color: hue.sand,
    marginTop: 6,
  },
  chipField: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  skipQWrap: {
    alignSelf: "center",
    marginBottom: space.xl,
  },
  skipQLink: {
    ...type.meta,
    color: text.faint,
  },
  skipQuizLink: {
    ...type.meta,
    color: text.faint,
  },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.jumbo,
  },
  doneLine: {
    fontFamily: font.serifLightItalic,
    fontSize: 16,
    color: hue.sand,
    textAlign: "center",
  },
});
