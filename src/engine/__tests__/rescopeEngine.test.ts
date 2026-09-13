import { describe, expect, it } from "vitest";

import {
  allocate,
  assessQuestRisk,
  buildSplitPlan,
  canSuggest,
  SPLIT_WEIGHTS,
  type RescopeQuest,
} from "../rescopeEngine";
import { DEFAULT_SESSION_MIN } from "../gameRules";

const NOW = new Date("2026-03-14T18:00:00.000Z");

function quest(overrides: Partial<RescopeQuest> = {}): RescopeQuest {
  return {
    id: "q1",
    title: "Finish the graphs section",
    status: "pending",
    est_duration_min: 180,
    due_at: "2026-03-14T22:00:00.000Z",
    quest_date: "2026-03-14",
    created_at: "2026-03-08T09:00:00.000Z",
    times_postponed: 2,
    deadline_external: false,
    parent_quest_id: null,
    xp_reward: 100,
    gold_reward: 20,
    ...overrides,
  };
}

/**
 * THE INVARIANT. Rescoping rearranges work; it can never mint or destroy XP.
 * public.accept_rescope() re-asserts this server-side before inserting a row.
 */
describe("SPLIT reward preservation", () => {
  for (const minutes of [90, 180, 240]) {
    it(`preserves XP and gold exactly for a ${minutes}-minute parent`, () => {
      const parent = quest({ est_duration_min: minutes });
      const plan = buildSplitPlan(parent, DEFAULT_SESSION_MIN, NOW);

      expect(plan.length).toBeGreaterThanOrEqual(2);
      expect(plan.reduce((s, p) => s + p.reward_xp, 0)).toBe(parent.xp_reward);
      expect(plan.reduce((s, p) => s + p.reward_gold, 0)).toBe(parent.gold_reward);
    });
  }

  it("preserves rewards for every difficulty tier and every part count", () => {
    const tiers: Array<[number, number]> = [
      [25, 5],
      [50, 10],
      [100, 20],
      [250, 50],
    ];
    for (const [xp, gold] of tiers) {
      for (const parts of [2, 3, 4]) {
        const weights = SPLIT_WEIGHTS[parts] ?? [];
        const xpParts = allocate(xp, weights);
        const goldParts = allocate(gold, weights);
        expect(xpParts.reduce((s, n) => s + n, 0)).toBe(xp);
        expect(goldParts.reduce((s, n) => s + n, 0)).toBe(gold);
        expect(xpParts.every((n) => n >= 0)).toBe(true);
      }
    }
  });

  it("gives every stage a non-zero share of the work", () => {
    const plan = buildSplitPlan(quest({ est_duration_min: 240 }), DEFAULT_SESSION_MIN, NOW);
    expect(plan.every((p) => p.est_duration_min >= 5)).toBe(true);
    expect(plan.every((p) => p.reward_xp > 0)).toBe(true);
  });
});

describe("intervention ladder", () => {
  const ctx = (q: RescopeQuest) => ({ quests: [q], completions: [], now: NOW });

  it("says nothing when risk is below 0.55", () => {
    const calm = quest({
      est_duration_min: 30,
      due_at: "2026-04-30T22:00:00.000Z",
      quest_date: "2026-04-30",
      created_at: "2026-03-14T09:00:00.000Z",
      times_postponed: 0,
    });
    const assessment = assessQuestRisk(calm, ctx(calm));
    expect(assessment).toBeNull();
  });

  it("never suggests anything for a quest with an external deadline", () => {
    const external = quest({ deadline_external: true });
    expect(assessQuestRisk(external, ctx(external))).toBeNull();
  });

  it("never suggests anything for a quest that is already a rescoped child", () => {
    const child = quest({ parent_quest_id: "parent-1" });
    expect(assessQuestRisk(child, ctx(child))).toBeNull();
  });

  it("never suggests anything for a completed quest", () => {
    const done = quest({ status: "completed" });
    expect(assessQuestRisk(done, ctx(done))).toBeNull();
  });

  it("chooses SPLIT for an oversized quest", () => {
    const big = quest({ est_duration_min: 180 });
    const assessment = assessQuestRisk(big, ctx(big));
    expect(assessment?.intervention).toBe("SPLIT");
    expect(assessment?.risk).toBeGreaterThanOrEqual(0.55);
  });

  it("chooses SHRINK for a repeatedly postponed quest that is not oversized", () => {
    const nagging = quest({ est_duration_min: 45, times_postponed: 3 });
    const assessment = assessQuestRisk(nagging, ctx(nagging));
    expect(assessment?.intervention).toBe("SHRINK");
  });

  it("keeps the risk score inside [0,1]", () => {
    const extreme = quest({
      est_duration_min: 480,
      times_postponed: 99,
      created_at: "2020-01-01T00:00:00.000Z",
      due_at: "2020-01-01T00:00:00.000Z",
    });
    const assessment = assessQuestRisk(extreme, ctx(extreme));
    expect(assessment!.risk).toBeLessThanOrEqual(1);
    expect(assessment!.risk).toBeGreaterThanOrEqual(0);
  });
});

describe("rate limiting", () => {
  const iso = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();

  it("allows a first suggestion", () => {
    expect(canSuggest("q1", [], NOW).allowed).toBe(true);
  });

  it("allows only one suggestion per quest per 24 hours", () => {
    const history = [{ quest_id: "q1", outcome: "PENDING", suggested_at: iso(3) }];
    expect(canSuggest("q1", history, NOW).allowed).toBe(false);
    expect(canSuggest("q2", history, NOW).allowed).toBe(true);
  });

  it("allows three suggestions per user per day, not four", () => {
    const history = ["a", "b", "c"].map((id) => ({
      quest_id: id,
      outcome: "PENDING",
      suggested_at: iso(5),
    }));
    expect(canSuggest("d", history, NOW).allowed).toBe(false);
  });

  it("suppresses for 72 hours after three consecutive dismissals", () => {
    const history = ["a", "b", "c"].map((id, i) => ({
      quest_id: id,
      outcome: "DISMISSED",
      suggested_at: iso(40 + i),
      responded_at: iso(30 + i),
    }));
    expect(canSuggest("d", history, NOW).allowed).toBe(false);

    const old = history.map((h) => ({
      ...h,
      suggested_at: iso(200),
      responded_at: iso(190),
    }));
    expect(canSuggest("d", old, NOW).allowed).toBe(true);
  });

  it("forgives the dismissal streak once a suggestion is accepted", () => {
    const history = [
      { quest_id: "a", outcome: "DISMISSED", suggested_at: iso(60), responded_at: iso(58) },
      { quest_id: "b", outcome: "DISMISSED", suggested_at: iso(50), responded_at: iso(48) },
      { quest_id: "c", outcome: "ACCEPTED", suggested_at: iso(40), responded_at: iso(38) },
    ];
    expect(canSuggest("d", history, NOW).allowed).toBe(true);
  });
});
