/**
 * Life RPG constants.
 *
 * Reward VALUES are not here on purpose. public.quest_rewards() in Postgres is
 * the single source of truth for xp_reward / gold_reward, and rescoped children
 * carry locked values that sum to their parent's. Anything in this file is
 * presentation, categorisation or scoring input — never an award.
 */

export type AttributeKey = "FOCUS" | "BODY" | "MIND" | "CRAFT";

export type ActivityKey =
  "SLEEP" | "WALKING" | "CODING" | "JOBS" | "SAVING" | "CLEAN_ROOM" | "MEDITATION" | "GYM";

/** The recommender's fallback session length before a user has any history. */
export const DEFAULT_SESSION_MIN = 45;

/** Completions required before the measured median replaces the fallback. */
export const MEDIAN_MIN_SAMPLES = 5;

export const ATTRIBUTES: Record<
  AttributeKey,
  { key: AttributeKey; label: string; zone: string; tone: string; blurb: string }
> = {
  FOCUS: {
    key: "FOCUS",
    label: "Focus",
    zone: "SANCTUARY",
    tone: "var(--arcane)",
    blurb: "Stillness, money, order",
  },
  BODY: {
    key: "BODY",
    label: "Body",
    zone: "TRAINING GROUND",
    tone: "var(--success)",
    blurb: "Sleep, movement, strength",
  },
  MIND: {
    key: "MIND",
    label: "Mind",
    zone: "LIBRARY",
    tone: "var(--accent)",
    blurb: "Study, practice, craft of thought",
  },
  CRAFT: {
    key: "CRAFT",
    label: "Craft",
    zone: "WORKSHOP",
    tone: "var(--ember)",
    blurb: "Work, applications, output",
  },
};

export const ATTRIBUTE_ORDER: AttributeKey[] = ["MIND", "BODY", "FOCUS", "CRAFT"];

export const ACTIVITY_ATTRIBUTE_MAP: Record<ActivityKey, AttributeKey> = {
  SLEEP: "BODY",
  WALKING: "BODY",
  GYM: "BODY",
  CODING: "MIND",
  MEDITATION: "FOCUS",
  SAVING: "FOCUS",
  CLEAN_ROOM: "FOCUS",
  JOBS: "CRAFT",
};

/**
 * Three activities carry bespoke questions and interpolated quest titles; the
 * other five share two generic questions and a generic template. Both kinds
 * live in the same registry, so deepening a shallow activity is a data change
 * in activitySchemas.ts — not a code change.
 */
export const ACTIVITIES: Array<{
  key: ActivityKey;
  label: string;
  glyph: string;
  category: string;
  depth: "deep" | "shallow";
  caption: string;
}> = [
  {
    key: "CODING",
    label: "Coding",
    glyph: "◈",
    category: "Coding",
    depth: "deep",
    caption: "Practice, build, learn",
  },
  {
    key: "WALKING",
    label: "Walking",
    glyph: "◇",
    category: "Fitness",
    depth: "deep",
    caption: "Steps, daily",
  },
  {
    key: "MEDITATION",
    label: "Meditation",
    glyph: "○",
    category: "Mind",
    depth: "deep",
    caption: "Sit, breathe",
  },
  { key: "GYM", label: "Gym", glyph: "▲", category: "Fitness", depth: "shallow", caption: "Train" },
  {
    key: "SLEEP",
    label: "Sleep",
    glyph: "▁",
    category: "Health",
    depth: "shallow",
    caption: "Rest well",
  },
  {
    key: "JOBS",
    label: "Jobs",
    glyph: "◆",
    category: "Career",
    depth: "shallow",
    caption: "Apply, prepare",
  },
  {
    key: "SAVING",
    label: "Saving",
    glyph: "▣",
    category: "Money",
    depth: "shallow",
    caption: "Set aside",
  },
  {
    key: "CLEAN_ROOM",
    label: "Clean Room",
    glyph: "▤",
    category: "Home",
    depth: "shallow",
    caption: "Reset the space",
  },
];

export const DEEP_ACTIVITY_PRIORITY: ActivityKey[] = ["CODING", "WALKING", "MEDITATION"];

export function activityAttribute(key: string | null | undefined): AttributeKey | null {
  if (!key) return null;
  return ACTIVITY_ATTRIBUTE_MAP[key as ActivityKey] ?? null;
}

export function activityMeta(key: string | null | undefined) {
  return ACTIVITIES.find((a) => a.key === key) ?? null;
}

/** Life World zone tiers, keyed off attribute XP. */
export const ZONE_TIERS = [0, 200, 600, 1500] as const;

export function tierForXp(xp: number) {
  let tier = 1;
  for (const [index, threshold] of ZONE_TIERS.entries()) if (xp >= threshold) tier = index + 1;
  return tier;
}

/** Chronicle milestones — each earns a wax seal. */
export const MILESTONES: Array<{ code: string; level: number; name: string; unlocks: string }> = [
  {
    code: "m_apprentice",
    level: 3,
    name: "Apprentice",
    unlocks: "Your world gains its first structures",
  },
  { code: "m_journeyman", level: 6, name: "Journeyman", unlocks: "Zone tiers begin to rise" },
  {
    code: "m_seasoned",
    level: 12,
    name: "Seasoned",
    unlocks: "The chronicle opens a second ledger",
  },
  { code: "m_veteran", level: 18, name: "Veteran", unlocks: "Gold seals available in rewards" },
  { code: "m_elite", level: 25, name: "Elite", unlocks: "The cartographer marks your map" },
];

/** Wax seal tints by achievement category. */
export const SEAL_TINTS: Record<string, string> = {
  quests: "var(--primary)",
  streak: "var(--ember)",
  xp: "var(--accent)",
  level: "var(--arcane)",
  milestone: "var(--success)",
};

export const RARITY_TONE: Record<string, string> = {
  common: "var(--muted-foreground)",
  rare: "var(--accent)",
  epic: "var(--arcane)",
  legendary: "var(--primary)",
};

/** Reward preferences offered at onboarding; they reorder the shop. */
export const REWARD_PREFS: Array<{ key: string; label: string; caption: string }> = [
  { key: "cosmetic", label: "Ornament", caption: "Seals and marks on the chronicle" },
  { key: "progress", label: "Progress", caption: "Anything that moves the bar" },
  { key: "protection", label: "Protection", caption: "Guard the chain on a bad day" },
  { key: "world", label: "World", caption: "Watch the map grow" },
  { key: "mastery", label: "Mastery", caption: "Depth in one attribute" },
  { key: "variety", label: "Variety", caption: "Something different each week" },
  { key: "quiet", label: "Quiet", caption: "As little noise as possible" },
];

export const MAIN_GOALS: Array<{ key: string; label: string; caption: string }> = [
  { key: "discipline", label: "Discipline", caption: "Do the thing without negotiating" },
  { key: "career", label: "Career", caption: "Skills, applications, output" },
  { key: "health", label: "Health", caption: "Sleep, movement, strength" },
  { key: "focus", label: "Focus", caption: "Attention that holds" },
  { key: "balance", label: "Balance", caption: "All four, none neglected" },
];
