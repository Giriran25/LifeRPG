/**
 * One registry, one renderer.
 *
 * Every activity — the three deep ones and the five shallow ones — is described
 * by the same discriminated union and drawn by the same QuestionRenderer. Giving
 * a shallow activity richer questions is a data change in this file, not new UI
 * code and not a new screen.
 */

import type { ActivityKey } from "./gameRules";

export type ActivityQuestion =
  | {
      kind: "number";
      id: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      unit?: string;
      default: number;
      optional?: boolean;
    }
  | { kind: "timeOfDay"; id: string; label: string; default: string; optional?: boolean }
  | {
      kind: "singleChoice";
      id: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      default: string;
      optional?: boolean;
    }
  | {
      kind: "multiChoice";
      id: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      default: string[];
      optional?: boolean;
    }
  | {
      kind: "chips";
      id: string;
      label: string;
      options: number[];
      unit?: string;
      default: number;
      optional?: boolean;
    }
  | {
      kind: "text";
      id: string;
      label: string;
      placeholder?: string;
      default: string;
      optional?: boolean;
    }
  | { kind: "date"; id: string; label: string; default: string; optional?: boolean }
  | {
      kind: "currency";
      id: string;
      label: string;
      symbol: string;
      min: number;
      max: number;
      default: number;
      optional?: boolean;
    };

export type ActivityConfig = Record<string, string | number | string[]>;

const WEEK_DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

/** The two generic questions every shallow activity shares. */
function shallowQuestions(perWeekLabel: string, minutesDefault: number): ActivityQuestion[] {
  return [
    {
      kind: "number",
      id: "times_per_week",
      label: perWeekLabel,
      min: 1,
      max: 7,
      unit: "per week",
      default: 3,
    },
    {
      kind: "number",
      id: "minutes_per_session",
      label: "Minutes per session",
      min: 10,
      max: 180,
      step: 5,
      unit: "min",
      default: minutesDefault,
    },
  ];
}

export const ACTIVITY_SCHEMAS: Record<ActivityKey, ActivityQuestion[]> = {
  // ---- deep ----------------------------------------------------------------
  CODING: [
    {
      kind: "singleChoice",
      id: "subject",
      label: "What are you learning?",
      options: [
        { value: "DSA", label: "DSA" },
        { value: "Web", label: "Web" },
        { value: "Mobile", label: "Mobile" },
        { value: "ML", label: "ML" },
        { value: "Systems", label: "Systems" },
        { value: "Other", label: "Other" },
      ],
      default: "DSA",
    },
    {
      kind: "chips",
      id: "minutes_per_session",
      label: "Minutes per session",
      options: [30, 45, 60, 90],
      unit: "min",
      default: 45,
    },
    {
      kind: "number",
      id: "sessions_per_week",
      label: "Sessions per week",
      min: 1,
      max: 14,
      default: 4,
    },
    {
      kind: "text",
      id: "target",
      label: "Target or project",
      placeholder: "Optional — e.g. finish the graphs section",
      default: "",
      optional: true,
    },
  ],
  WALKING: [
    {
      kind: "number",
      id: "step_target",
      label: "Daily step target",
      min: 1000,
      max: 30000,
      step: 500,
      unit: "steps",
      default: 8000,
    },
    { kind: "number", id: "days_per_week", label: "Days per week", min: 1, max: 7, default: 5 },
  ],
  MEDITATION: [
    {
      kind: "number",
      id: "minutes_per_session",
      label: "Session duration",
      min: 5,
      max: 60,
      step: 5,
      unit: "min",
      default: 10,
    },
    {
      kind: "number",
      id: "sessions_per_week",
      label: "Sessions per week",
      min: 1,
      max: 14,
      default: 5,
    },
    {
      kind: "timeOfDay",
      id: "preferred_time",
      label: "Preferred time",
      default: "07:30",
      optional: true,
    },
  ],

  // ---- shallow -------------------------------------------------------------
  SLEEP: shallowQuestions("Nights you want to hit your target", 30),
  JOBS: shallowQuestions("Sessions per week", 45),
  SAVING: shallowQuestions("Times per week", 20),
  CLEAN_ROOM: shallowQuestions("Times per week", 25),
  GYM: shallowQuestions("Days per week", 60),
};

/** Optional day picker, used by CLEAN_ROOM when a user wants one. */
export const PREFERRED_DAYS_QUESTION: ActivityQuestion = {
  kind: "multiChoice",
  id: "preferred_days",
  label: "Preferred days",
  options: WEEK_DAYS,
  default: [],
  optional: true,
};

export function defaultConfigFor(key: ActivityKey): ActivityConfig {
  const config: ActivityConfig = {};
  for (const q of ACTIVITY_SCHEMAS[key]) config[q.id] = q.default;
  return config;
}
