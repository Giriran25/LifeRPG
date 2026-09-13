import { describe, expect, it } from "vitest";

import { applyCompletion, type StreakState } from "../streakEngine";

const fresh: StreakState = { current: 0, longest: 0, lastActiveDate: null };

describe("StreakEngine", () => {
  it("starts a chain at 1", () => {
    const result = applyCompletion(fresh, "2026-03-14");
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });

  it("does not double-increment on a second completion the same day", () => {
    const first = applyCompletion(fresh, "2026-03-14");
    const second = applyCompletion(first, "2026-03-14");
    expect(second.current).toBe(1);
    expect(second.advanced).toBe(false);
  });

  it("increments on consecutive days", () => {
    let state: StreakState = fresh;
    for (const day of ["2026-03-14", "2026-03-15", "2026-03-16"]) {
      state = applyCompletion(state, day);
    }
    expect(state.current).toBe(3);
    expect(state.longest).toBe(3);
  });

  it("resets to 1 after a gap", () => {
    let state: StreakState = fresh;
    for (const day of ["2026-03-14", "2026-03-15", "2026-03-16"]) {
      state = applyCompletion(state, day);
    }
    const afterGap = applyCompletion(state, "2026-03-20");
    expect(afterGap.current).toBe(1);
  });

  it("preserves longest across a reset", () => {
    let state: StreakState = fresh;
    for (const day of ["2026-03-14", "2026-03-15", "2026-03-16", "2026-03-17"]) {
      state = applyCompletion(state, day);
    }
    const afterGap = applyCompletion(state, "2026-03-25");
    expect(afterGap.current).toBe(1);
    expect(afterGap.longest).toBe(4);
  });

  it("spends a shield to repair a single missed day", () => {
    let state: StreakState = fresh;
    state = applyCompletion(state, "2026-03-14");
    state = applyCompletion(state, "2026-03-15");
    const repaired = applyCompletion(state, "2026-03-17", { shields: 1 });
    expect(repaired.current).toBe(3);
    expect(repaired.shieldUsed).toBe(true);
    expect(repaired.shieldsLeft).toBe(0);
  });

  it("resets when there is no shield to spend", () => {
    let state: StreakState = fresh;
    state = applyCompletion(state, "2026-03-14");
    state = applyCompletion(state, "2026-03-15");
    const broken = applyCompletion(state, "2026-03-17", { shields: 0 });
    expect(broken.current).toBe(1);
    expect(broken.longest).toBe(2);
  });
});
