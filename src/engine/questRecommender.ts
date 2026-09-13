/**
 * Read-side quest scoring. Awards nothing, writes nothing — safe on the client.
 *
 *   score = 0.30·urgency + 0.25·durationFit + 0.20·timeOfDayFit
 *         + 0.15·attributeNeed + 0.10·affinity − 0.30·overload
 *
 * Every term is clamped to [0,1] before weighting, and the breakdown is
 * returned so "WHY THIS QUEST?" can show real numbers rather than a vibe.
 */

import {
  ATTRIBUTE_ORDER,
  DEFAULT_SESSION_MIN,
  MEDIAN_MIN_SAMPLES,
  activityAttribute,
  type AttributeKey,
} from "./gameRules";

export const RECOMMENDER_WEIGHTS = {
  urgency: 0.3,
  durationFit: 0.25,
  timeOfDayFit: 0.2,
  attributeNeed: 0.15,
  affinity: 0.1,
  overload: -0.3,
} as const;

export type RecommenderTerm = keyof typeof RECOMMENDER_WEIGHTS;

export type ScoredQuest = {
  questId: string;
  score: number;
  breakdown: Array<{
    term: RecommenderTerm;
    label: string;
    raw: number;
    weight: number;
    weighted: number;
  }>;
  rationale: string;
};

export type RecommenderQuest = {
  id: string;
  title: string;
  status: string;
  est_duration_min: number;
  due_at: string | null;
  quest_date: string;
  activity_key: string | null;
  attribute: string | null;
  parent_quest_id?: string | null;
};

export type RecommenderCompletion = {
  activity_key: string | null;
  actual_duration_min: number | null;
  completed_at: string;
};

export type RecommenderInput = {
  quests: RecommenderQuest[];
  completions: RecommenderCompletion[];
  attributes: Record<AttributeKey, number>;
  now?: Date;
};

const TERM_LABELS: Record<RecommenderTerm, string> = {
  urgency: "DEADLINE",
  durationFit: "FITS YOUR SESSION",
  timeOfDayFit: "TIME OF DAY",
  attributeNeed: "ATTRIBUTE NEED",
  affinity: "YOUR HABIT",
  overload: "TODAY'S LOAD",
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Median of the last 20 measured sessions; the default until 5 exist. */
export function medianSession(completions: RecommenderCompletion[]) {
  const durations = completions
    .filter((c) => typeof c.actual_duration_min === "number" && (c.actual_duration_min ?? 0) > 0)
    .slice(-20)
    .map((c) => c.actual_duration_min as number)
    .sort((a, b) => a - b);
  if (durations.length < MEDIAN_MIN_SAMPLES) return DEFAULT_SESSION_MIN;
  const mid = Math.floor(durations.length / 2);
  const upper = durations[mid] ?? DEFAULT_SESSION_MIN;
  if (durations.length % 2) return upper;
  return Math.round(((durations[mid - 1] ?? upper) + upper) / 2);
}

export function hoursUntil(dueAt: string | null, questDate: string, now: Date) {
  const due = dueAt ? new Date(dueAt) : new Date(`${questDate}T23:59:59`);
  return (due.getTime() - now.getTime()) / 3_600_000;
}

/** 0 when a week away, 1 once it is due or overdue. */
function urgencyOf(quest: RecommenderQuest, now: Date) {
  const hours = hoursUntil(quest.due_at, quest.quest_date, now);
  if (hours <= 0) return 1;
  return clamp01(1 - hours / 168);
}

/** 1 when the estimate matches the user's usual session length. */
function durationFitOf(quest: RecommenderQuest, median: number) {
  const est = Math.max(1, quest.est_duration_min);
  return clamp01(1 - Math.abs(est - median) / Math.max(est, median));
}

/** How often this activity is actually completed in the current hour band. */
function timeOfDayFitOf(quest: RecommenderQuest, completions: RecommenderCompletion[], now: Date) {
  const relevant = completions.filter((c) => c.activity_key === quest.activity_key);
  if (relevant.length < 3) return 0.5;
  const hour = now.getHours();
  const near = relevant.filter((c) => {
    const h = new Date(c.completed_at).getHours();
    const delta = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour));
    return delta <= 2;
  });
  return clamp01(near.length / relevant.length + 0.25);
}

/** The attribute furthest behind the leader scores highest. */
function attributeNeedOf(quest: RecommenderQuest, attributes: Record<AttributeKey, number>) {
  const attr = (quest.attribute as AttributeKey | null) ?? activityAttribute(quest.activity_key);
  if (!attr) return 0.5;
  const values = ATTRIBUTE_ORDER.map((k) => attributes[k] ?? 0);
  const max = Math.max(...values, 1);
  return clamp01(1 - (attributes[attr] ?? 0) / max);
}

/** Share of recent completions belonging to this activity. */
function affinityOf(quest: RecommenderQuest, completions: RecommenderCompletion[]) {
  if (!completions.length || !quest.activity_key) return 0.4;
  const mine = completions.filter((c) => c.activity_key === quest.activity_key).length;
  return clamp01(mine / completions.length + 0.2);
}

/** Pending minutes already on the plate, against two typical sessions. */
function overloadOf(quests: RecommenderQuest[], median: number) {
  const pendingMinutes = quests
    .filter((q) => q.status === "pending")
    .reduce((sum, q) => sum + Math.max(0, q.est_duration_min), 0);
  return clamp01(pendingMinutes / Math.max(60, median * 4));
}

function rationaleFor(
  quest: RecommenderQuest,
  top: { term: RecommenderTerm; raw: number },
  median: number,
  now: Date,
) {
  const activity = (quest.activity_key ?? "this").replace(/_/g, " ").toLowerCase();
  switch (top.term) {
    case "urgency": {
      const hours = hoursUntil(quest.due_at, quest.quest_date, now);
      if (hours <= 0) return "THIS ONE IS ALREADY PAST ITS DEADLINE";
      if (hours < 6) return `DUE IN UNDER ${Math.max(1, Math.round(hours))} HOURS`;
      return "THE DEADLINE IS THE NEAREST ON YOUR LIST";
    }
    case "durationFit":
      return `${quest.est_duration_min} MINUTES MATCHES YOUR USUAL ${median}-MINUTE SESSION`;
    case "timeOfDayFit":
      return `YOU USUALLY COMPLETE ${activity.toUpperCase()} QUESTS AROUND THIS HOUR`;
    case "attributeNeed": {
      const attr =
        (quest.attribute as AttributeKey | null) ?? activityAttribute(quest.activity_key) ?? "THIS";
      return `${attr} IS BELOW THIS WEEK'S TARGET`;
    }
    case "affinity":
      return `${activity.toUpperCase()} IS THE HABIT YOU KEEP MOST RELIABLY`;
    default:
      return "THE SMALLEST USEFUL THING ON A FULL DAY";
  }
}

export function scoreQuest(quest: RecommenderQuest, input: RecommenderInput): ScoredQuest {
  const now = input.now ?? new Date();
  const median = medianSession(input.completions);

  const raws: Record<RecommenderTerm, number> = {
    urgency: urgencyOf(quest, now),
    durationFit: durationFitOf(quest, median),
    timeOfDayFit: timeOfDayFitOf(quest, input.completions, now),
    attributeNeed: attributeNeedOf(quest, input.attributes),
    affinity: affinityOf(quest, input.completions),
    overload: overloadOf(input.quests, median),
  };

  const breakdown = (Object.keys(RECOMMENDER_WEIGHTS) as RecommenderTerm[]).map((term) => ({
    term,
    label: TERM_LABELS[term],
    raw: raws[term],
    weight: RECOMMENDER_WEIGHTS[term],
    weighted: raws[term] * RECOMMENDER_WEIGHTS[term],
  }));

  const score = breakdown.reduce((sum, b) => sum + b.weighted, 0);

  // The rationale comes from the largest positive contribution, so the sentence
  // always explains the term that actually decided it.
  const top = breakdown
    .filter((b) => b.weight > 0)
    .reduce((best, b) => (b.weighted > best.weighted ? b : best));

  return {
    questId: quest.id,
    score,
    breakdown,
    rationale: rationaleFor(quest, top, median, now),
  };
}

/** Highest-scoring pending quest, or null when there is nothing to do. */
export function recommendQuest(input: RecommenderInput) {
  const candidates = input.quests.filter((q) => q.status === "pending");
  if (!candidates.length) return null;
  const scored = candidates.map((q) => ({ quest: q, scored: scoreQuest(q, input) }));
  scored.sort((a, b) => b.scored.score - a.scored.score);
  return scored[0];
}
