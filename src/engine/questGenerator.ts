/**
 * Turns onboarding answers into exactly three starting quests.
 *
 * Three, never four: the dashboard is never empty and never crowded. Deep
 * activities come first and interpolate the user's own numbers; shallow ones
 * fall back to a generic template. Difficulty is always medium, so the first
 * completion is worth 50 XP and lands the player on level 2 immediately.
 */

import {
  ACTIVITY_ATTRIBUTE_MAP,
  DEEP_ACTIVITY_PRIORITY,
  activityMeta,
  type ActivityKey,
  type AttributeKey,
} from "./gameRules";
import type { ActivityConfig } from "./activitySchemas";

export const STARTER_QUEST_COUNT = 3;

export type GeneratedQuest = {
  title: string;
  description: string | null;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "epic";
  activity_key: ActivityKey | null;
  attribute: AttributeKey | null;
  est_duration_min: number;
};

export type SelectedActivity = { activity_key: ActivityKey; config: ActivityConfig };

function num(config: ActivityConfig, key: string, fallback: number) {
  const raw = config[key];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(config: ActivityConfig, key: string) {
  const raw = config[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function clampMinutes(n: number) {
  return Math.max(5, Math.min(480, Math.round(n)));
}

/** The three deep activities get real sentences built from real answers. */
function deepQuest(key: ActivityKey, config: ActivityConfig): GeneratedQuest | null {
  const meta = activityMeta(key);
  if (!meta) return null;
  const base = {
    category: meta.category,
    difficulty: "medium" as const,
    activity_key: key,
    attribute: ACTIVITY_ATTRIBUTE_MAP[key],
  };

  if (key === "CODING") {
    const minutes = num(config, "minutes_per_session", 45);
    const subject = str(config, "subject") || "DSA";
    const target = str(config, "target");
    return {
      ...base,
      title: `Code for ${minutes} minutes on ${subject}`,
      description: target ? `Working towards: ${target}` : null,
      est_duration_min: clampMinutes(minutes),
    };
  }

  if (key === "WALKING") {
    const steps = num(config, "step_target", 8000);
    return {
      ...base,
      title: `Walk ${steps.toLocaleString("en-US")} steps`,
      description: null,
      // ~100 steps a minute, kept inside a believable single outing
      est_duration_min: clampMinutes(Math.min(90, Math.max(15, steps / 100))),
    };
  }

  if (key === "MEDITATION") {
    const minutes = num(config, "minutes_per_session", 10);
    const time = str(config, "preferred_time");
    return {
      ...base,
      title: `Meditate for ${minutes} minutes`,
      description: time ? `Preferred time: ${time}` : null,
      est_duration_min: clampMinutes(minutes),
    };
  }

  return null;
}

/** Shallow activities share one template built from the two generic answers. */
function shallowQuest(key: ActivityKey, config: ActivityConfig): GeneratedQuest | null {
  const meta = activityMeta(key);
  if (!meta) return null;
  const minutes = num(config, "minutes_per_session", 30);
  return {
    title: `${meta.label} session — ${clampMinutes(minutes)} minutes`,
    description: null,
    category: meta.category,
    difficulty: "medium",
    activity_key: key,
    attribute: ACTIVITY_ATTRIBUTE_MAP[key],
    est_duration_min: clampMinutes(minutes),
  };
}

/** Used when a player somehow reaches the dashboard having chosen nothing. */
export const FALLBACK_QUESTS: GeneratedQuest[] = [
  {
    title: "Complete 2 coding practice problems",
    description: null,
    category: "Coding",
    difficulty: "medium",
    activity_key: "CODING",
    attribute: "MIND",
    est_duration_min: 45,
  },
  {
    title: "Walk for 30 minutes",
    description: null,
    category: "Fitness",
    difficulty: "medium",
    activity_key: "WALKING",
    attribute: "BODY",
    est_duration_min: 30,
  },
  {
    title: "Complete a 10-minute meditation",
    description: null,
    category: "Mind",
    difficulty: "medium",
    activity_key: "MEDITATION",
    attribute: "FOCUS",
    est_duration_min: 10,
  },
];

export function generateStarterQuests(selected: SelectedActivity[]): GeneratedQuest[] {
  const byKey = new Map(selected.map((s) => [s.activity_key, s.config]));
  const quests: GeneratedQuest[] = [];

  // 1. deep activities, in priority order
  for (const key of DEEP_ACTIVITY_PRIORITY) {
    if (quests.length >= STARTER_QUEST_COUNT) break;
    const config = byKey.get(key);
    if (!config) continue;
    const quest = deepQuest(key, config);
    if (quest) quests.push(quest);
  }

  // 2. top up from whatever shallow activities were chosen
  for (const { activity_key, config } of selected) {
    if (quests.length >= STARTER_QUEST_COUNT) break;
    if (DEEP_ACTIVITY_PRIORITY.includes(activity_key)) continue;
    const quest = shallowQuest(activity_key, config);
    if (quest) quests.push(quest);
  }

  // 3. never hand back an empty board
  for (const quest of FALLBACK_QUESTS) {
    if (quests.length >= STARTER_QUEST_COUNT) break;
    if (quests.some((q) => q.activity_key === quest.activity_key)) continue;
    quests.push(quest);
  }

  return quests.slice(0, STARTER_QUEST_COUNT);
}
