import { describe, expect, it } from "vitest";

import {
  medianSession,
  recommendQuest,
  scoreQuest,
  type RecommenderQuest,
} from "../questRecommender";
import { DEFAULT_SESSION_MIN } from "../gameRules";

const NOW = new Date("2026-03-14T18:00:00.000Z");

function quest(overrides: Partial<RecommenderQuest> = {}): RecommenderQuest {
  return {
    id: "q1",
    title: "Code for 45 minutes on DSA",
    status: "pending",
    est_duration_min: 45,
    due_at: "2026-03-14T22:00:00.000Z",
    quest_date: "2026-03-14",
    activity_key: "CODING",
    attribute: "MIND",
    parent_quest_id: null,
    ...overrides,
  };
}

const attributes = { FOCUS: 100, BODY: 200, MIND: 50, CRAFT: 0 };

describe("questRecommender", () => {
  it("returns a breakdown whose weighted terms sum to the reported score", () => {
    const q = quest();
    const scored = scoreQuest(q, { quests: [q], completions: [], attributes, now: NOW });
    const sum = scored.breakdown.reduce((s, b) => s + b.weighted, 0);
    expect(sum).toBeCloseTo(scored.score, 10);
  });

  it("keeps every raw term inside [0,1]", () => {
    const q = quest({ est_duration_min: 480, due_at: null });
    const scored = scoreQuest(q, { quests: [q], completions: [], attributes, now: NOW });
    for (const term of scored.breakdown) {
      expect(term.raw).toBeGreaterThanOrEqual(0);
      expect(term.raw).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to the default session length below five samples", () => {
    const few = [1, 2, 3, 4].map((n) => ({
      activity_key: "CODING",
      actual_duration_min: n * 10,
      completed_at: NOW.toISOString(),
    }));
    expect(medianSession(few)).toBe(DEFAULT_SESSION_MIN);
  });

  it("uses the measured median once enough sessions exist", () => {
    const many = [20, 30, 40, 50, 60].map((n) => ({
      activity_key: "CODING",
      actual_duration_min: n,
      completed_at: NOW.toISOString(),
    }));
    expect(medianSession(many)).toBe(40);
  });

  it("prefers the more urgent of two otherwise identical quests", () => {
    const soon = quest({ id: "soon", due_at: "2026-03-14T19:00:00.000Z" });
    const later = quest({
      id: "later",
      due_at: "2026-03-21T19:00:00.000Z",
      quest_date: "2026-03-21",
    });
    const best = recommendQuest({
      quests: [later, soon],
      completions: [],
      attributes,
      now: NOW,
    });
    expect(best?.quest.id).toBe("soon");
  });

  it("returns null when nothing is pending", () => {
    const done = quest({ status: "completed" });
    expect(recommendQuest({ quests: [done], completions: [], attributes, now: NOW })).toBeNull();
  });
});
