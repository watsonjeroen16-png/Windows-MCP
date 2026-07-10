import type { PersonalityId } from "./ids";

export interface PersonalityMeta {
  id: PersonalityId;
  name: string;
  /** One-word uppercase tag, right-aligned on the card. */
  tag: string;
  /** Canonical sample dialogue line — used VERBATIM on screen 5 (spec table). */
  sampleLine: string;
}

export const PERSONALITIES: readonly PersonalityMeta[] = [
  {
    id: "coach",
    name: "Coach",
    tag: "DRIVEN",
    sampleLine: "We've got a plan and today is step one — let's get to work.",
  },
  {
    id: "tough_love",
    name: "Tough Love",
    tag: "UNFILTERED",
    sampleLine: "Nobody is coming to save you. Show me what you've got.",
  },
  {
    id: "mentor",
    name: "Mentor",
    tag: "WISE",
    sampleLine: "Every master was once a beginner who refused to quit.",
  },
  {
    id: "supportive",
    name: "Supportive",
    tag: "WARM",
    sampleLine:
      "I'm proud of you for showing up today. We'll take it one step at a time, together.",
  },
  {
    id: "rival",
    name: "Rival",
    tag: "COMPETITIVE",
    sampleLine: "I've already finished my training today. Your move.",
  },
] as const;
