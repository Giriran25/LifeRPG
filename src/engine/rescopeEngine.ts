/**
 * Adaptive rescoping — the differentiator.
 *
 *   risk = 0.35·timePressure + 0.20·sizeMismatch + 0.15·staleness
 *        + 0.20·postponement + 0.10·workload
 *
 * Scoring only. This module never awards anything: a SPLIT plan proposes child
 * quests whose rewards sum EXACTLY to the parent's, and public.accept_rescope()
 * re-checks that sum server-side before inserting a single row. Rescoping
 * rearranges work; it can never mint XP.
 *
 * Silence is a valid output. Below the threshold this returns null.
 */

import { DEFAULT_SESSION_MIN } from "./gameRules";
import { hoursUntil, medianSession, type RecommenderCompletion } from "./questRecommender";

export const RESCOPE_ENGINE_VERSION = "rescope-v1";

export const RISK_WEIGHTS = {
  timePressure: 0.35,
  sizeMismatch: 0.2,
  staleness: 0.15,
  postponement: 0.2,
  workload: 0.1,
} as const;

export const RISK_THRESHOLD = 0.55;
export const RISK_THRESHOLD_URGENT = 0.7;

/** Split weights by part count. Each row sums to 1. */
export const SPLIT_WEIGHTS: Record<number, number[]> = {
  2: [0.5, 0.5],
  3: [0.3, 0.4, 0.3],
  4: [0.22, 0.3, 0.28, 0.2],
};

export type Intervention = "SPLIT" | "SHRINK" | "RESCHEDULE" | "EXTEND";

export type RescopeQuest = {
  id: string;
  title: string;
  status: string;
  est_duration_min: number;
  due_at: string | null;
  quest_date: string;
  created_at: string;
  times_postponed: number;
  deadline_external: boolean;
  parent_quest_id: string | null;
  xp_reward: number;
  gold_reward: number;
};

export type RescopeStage = {
  title: string;
  est_duration_min: number;
  reward_xp: number;
  reward_gold: number;
  due_at: string | null;
};

export type RiskAssessment = {
  questId: string;
  risk: number;
  breakdown: Array<{
    term: keyof typeof RISK_WEIGHTS;
    raw: number;
    weight: number;
    weighted: number;
  }>;
  intervention: Intervention;
  plan: RescopeStage[];
  rationale: string;
  engineVersion: string;
};

export type RescopeContext = {
  quests: RescopeQuest[];
  completions: RecommenderCompletion[];
  now?: Date;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** 1 once the deadline is inside an hour or gone; 0 a week out. */
function timePressureOf(quest: RescopeQuest, now: Date) {
  const hours = hoursUntil(quest.due_at, quest.quest_date, now);
  if (hours <= 1) return 1;
  return clamp01(1 - hours / 72);
}

/** How far the estimate overshoots the user's real session length. */
function sizeMismatchOf(quest: RescopeQuest, median: number) {
  const ratio = quest.est_duration_min / Math.max(1, median);
  if (ratio <= 1) return 0;
  return clamp01((ratio - 1) / 3);
}

/** Days the quest has sat untouched, saturating at a week. */
function stalenessOf(quest: RescopeQuest, now: Date) {
  const days = (now.getTime() - new Date(quest.created_at).getTime()) / 86_400_000;
  return clamp01(days / 7);
}

function postponementOf(quest: RescopeQuest) {
  return clamp01(quest.times_postponed / 3);
}

/** Pending minutes across the whole board, against four typical sessions. */
function workloadOf(quests: RescopeQuest[], median: number) {
  const pending = quests
    .filter((q) => q.status === "pending")
    .reduce((sum, q) => sum + Math.max(0, q.est_duration_min), 0);
  return clamp01(pending / Math.max(120, median * 4));
}

function partCountFor(est: number, median: number) {
  const ratio = est / Math.max(1, median);
  if (ratio >= 3.5) return 4;
  if (ratio >= 2.5) return 3;
  return 2;
}

/**
 * Distribute an integer total across weights with the remainder landing on the
 * last stage. sum(out) === total, always — this is the invariant the whole
 * feature rests on.
 */
export function allocate(total: number, weights: number[]): number[] {
  const out = weights.map((w) => Math.floor(total * w));
  const last = out.length - 1;
  if (last < 0) return out;
  const remainder = total - out.reduce((s, n) => s + n, 0);
  out[last] = (out[last] ?? 0) + remainder;
  return out;
}

function stagedDueAt(quest: RescopeQuest, index: number, count: number, now: Date) {
  const end = quest.due_at ? new Date(quest.due_at) : new Date(`${quest.quest_date}T23:59:59`);
  const start = now.getTime();
  const span = end.getTime() - start;
  if (span <= 0) return end.toISOString();
  return new Date(start + (span * (index + 1)) / count).toISOString();
}

export function buildSplitPlan(quest: RescopeQuest, median: number, now: Date): RescopeStage[] {
  const count = partCountFor(quest.est_duration_min, median);
  const weights = SPLIT_WEIGHTS[count] ?? [0.5, 0.5];
  const xp = allocate(quest.xp_reward, weights);
  const gold = allocate(quest.gold_reward, weights);
  const minutes = allocate(quest.est_duration_min, weights);

  return weights.map((_, i) => ({
    title: `${quest.title} — part ${i + 1} of ${count}`,
    est_duration_min: Math.max(5, Math.min(480, minutes[i] ?? 5)),
    reward_xp: xp[i] ?? 0,
    reward_gold: gold[i] ?? 0,
    due_at: stagedDueAt(quest, i, count, now),
  }));
}

function singleStagePlan(
  quest: RescopeQuest,
  minutes: number,
  dueAt: string | null,
  title: string,
): RescopeStage[] {
  return [
    {
      title,
      est_duration_min: Math.max(5, Math.min(480, Math.round(minutes))),
      reward_xp: quest.xp_reward,
      reward_gold: quest.gold_reward,
      due_at: dueAt,
    },
  ];
}

/**
 * Score one quest and pick at most one intervention. First match on the ladder
 * wins; no match means we say nothing at all.
 */
export function assessQuestRisk(quest: RescopeQuest, ctx: RescopeContext): RiskAssessment | null {
  const now = ctx.now ?? new Date();

  // Never rescope a quest whose deadline belongs to someone else, a quest that
  // is already a rescoped child, or one that is finished.
  if (quest.deadline_external) return null;
  if (quest.parent_quest_id) return null;
  if (quest.status !== "pending") return null;

  const median = ctx.completions.length ? medianSession(ctx.completions) : DEFAULT_SESSION_MIN;
  const hoursRemaining = hoursUntil(quest.due_at, quest.quest_date, now);

  const raws = {
    timePressure: timePressureOf(quest, now),
    sizeMismatch: sizeMismatchOf(quest, median),
    staleness: stalenessOf(quest, now),
    postponement: postponementOf(quest),
    workload: workloadOf(ctx.quests, median),
  };

  const breakdown = (Object.keys(RISK_WEIGHTS) as Array<keyof typeof RISK_WEIGHTS>).map((term) => ({
    term,
    raw: raws[term],
    weight: RISK_WEIGHTS[term],
    weighted: raws[term] * RISK_WEIGHTS[term],
  }));
  // clamped because summing five weighted floats can land a hair over 1
  const risk = clamp01(breakdown.reduce((sum, b) => sum + b.weighted, 0));

  if (risk < RISK_THRESHOLD) return null;

  const base = { questId: quest.id, risk, breakdown, engineVersion: RESCOPE_ENGINE_VERSION };

  if (risk >= RISK_THRESHOLD && quest.est_duration_min > 2 * median) {
    return {
      ...base,
      intervention: "SPLIT",
      plan: buildSplitPlan(quest, median, now),
      rationale: `This is ${quest.est_duration_min} minutes in one sitting, and your sessions usually run ${median}. Split into stages that still pay the full ${quest.xp_reward} XP.`,
    };
  }

  if (risk >= RISK_THRESHOLD && quest.times_postponed >= 2) {
    const shrunk = Math.max(5, Math.round(quest.est_duration_min * 0.5));
    return {
      ...base,
      intervention: "SHRINK",
      plan: singleStagePlan(quest, shrunk, quest.due_at, `${quest.title} (${shrunk} min)`),
      rationale: `Postponed ${quest.times_postponed} times. Cut it to ${shrunk} minutes — same reward, smaller ask.`,
    };
  }

  if (risk >= RISK_THRESHOLD_URGENT && hoursRemaining < 6 && !quest.deadline_external) {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    tomorrow.setHours(9, 0, 0, 0);
    return {
      ...base,
      intervention: "RESCHEDULE",
      plan: singleStagePlan(quest, quest.est_duration_min, tomorrow.toISOString(), quest.title),
      rationale: `Under ${Math.max(1, Math.round(hoursRemaining))} hours left and nothing started. Move it to tomorrow morning rather than lose it.`,
    };
  }

  if (risk >= RISK_THRESHOLD && !quest.deadline_external) {
    const extended = new Date(
      (quest.due_at ? new Date(quest.due_at) : new Date(`${quest.quest_date}T23:59:59`)).getTime() +
        2 * 86_400_000,
    );
    return {
      ...base,
      intervention: "EXTEND",
      plan: singleStagePlan(quest, quest.est_duration_min, extended.toISOString(), quest.title),
      rationale: "Two more days on the deadline. The quest is fine; the timing wasn't.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rate limiting. A suggestion engine that nags is worse than none.
// ---------------------------------------------------------------------------

export type SuggestionHistoryRow = {
  quest_id: string;
  outcome: string;
  suggested_at: string;
  responded_at?: string | null;
};

export const RATE_LIMITS = {
  perQuestHours: 24,
  perUserPerDay: 3,
  dismissStreakForSuppression: 3,
  suppressionHours: 72,
} as const;

/**
 * Whether a new suggestion may be raised for this quest right now:
 *   - one per quest per 24h
 *   - three per user per day
 *   - after three consecutive dismissals, nothing for 72h
 */
export function canSuggest(
  questId: string,
  history: SuggestionHistoryRow[],
  now: Date = new Date(),
): { allowed: boolean; reason?: string } {
  const ms = now.getTime();

  const forQuest = history.filter(
    (h) =>
      h.quest_id === questId &&
      ms - new Date(h.suggested_at).getTime() < RATE_LIMITS.perQuestHours * 3_600_000,
  );
  if (forQuest.length) return { allowed: false, reason: "already suggested for this quest today" };

  const last24h = history.filter((h) => ms - new Date(h.suggested_at).getTime() < 24 * 3_600_000);
  if (last24h.length >= RATE_LIMITS.perUserPerDay)
    return { allowed: false, reason: "daily suggestion limit reached" };

  const answered = history
    .filter((h) => h.outcome !== "PENDING")
    .sort(
      (a, b) =>
        new Date(b.responded_at ?? b.suggested_at).getTime() -
        new Date(a.responded_at ?? a.suggested_at).getTime(),
    );
  let streak = 0;
  for (const row of answered) {
    if (row.outcome === "DISMISSED") streak += 1;
    else break;
  }
  const lastDismissal = answered[0];
  if (streak >= RATE_LIMITS.dismissStreakForSuppression && lastDismissal) {
    const since = ms - new Date(lastDismissal.responded_at ?? lastDismissal.suggested_at).getTime();
    if (since < RATE_LIMITS.suppressionHours * 3_600_000)
      return { allowed: false, reason: "suppressed after repeated dismissals" };
  }

  return { allowed: true };
}

/** Highest-risk actionable suggestion across the board, respecting rate limits. */
export function findRescopeCandidate(
  ctx: RescopeContext,
  history: SuggestionHistoryRow[],
): RiskAssessment | null {
  const now = ctx.now ?? new Date();
  const found = ctx.quests
    .filter((q) => canSuggest(q.id, history, now).allowed)
    .map((q) => assessQuestRisk(q, ctx))
    .filter((a): a is RiskAssessment => a !== null)
    .sort((a, b) => b.risk - a.risk);
  return found[0] ?? null;
}
