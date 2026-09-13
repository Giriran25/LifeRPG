import { describe, expect, it } from "vitest";

import { levelForXp, levelProgress, xpForLevel } from "@/lib/game";

/**
 * game.ts mirrors public.xp_for_level / public.level_for_xp (25·(l−1)·l).
 * If these fail, the client mirror and Postgres have drifted apart.
 */
describe("XP curve", () => {
  it("is monotonically non-decreasing across 0–200,000 XP", () => {
    let previous = levelForXp(0);
    for (let xp = 0; xp <= 200_000; xp += 37) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("never lets total XP decrease across a level boundary", () => {
    for (let level = 1; level < 100; level += 1) {
      expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
      // the boundary XP value belongs to the new level, not the old one
      expect(levelForXp(xpForLevel(level + 1))).toBe(level + 1);
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it("keeps the in-level progress fraction inside [0,1]", () => {
    for (let xp = 0; xp <= 200_000; xp += 53) {
      const { into, span, percent } = levelProgress(xp);
      expect(into).toBeGreaterThanOrEqual(0);
      expect(into).toBeLessThanOrEqual(span);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    }
  });

  it("is non-linear: each level costs more than the last", () => {
    for (let level = 2; level < 50; level += 1) {
      const thisLevel = xpForLevel(level + 1) - xpForLevel(level);
      const lastLevel = xpForLevel(level) - xpForLevel(level - 1);
      expect(thisLevel).toBeGreaterThan(lastLevel);
    }
  });

  it("puts the first medium quest straight onto level 2", () => {
    expect(levelForXp(50)).toBe(2);
  });
});
