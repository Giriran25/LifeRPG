/**
 * Client-side mirror of the streak block inside public.complete_quest().
 *
 * Postgres stays authoritative — this exists so the optimistic update can show
 * the chain advancing before the round trip, and so the rules are testable
 * without a database. Keep the two in step.
 */

export type StreakState = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
};

export type StreakOptions = { shields?: number };

export type StreakResult = StreakState & {
  advanced: boolean;
  shieldUsed: boolean;
  shieldsLeft: number;
};

function daysBetween(fromISO: string, toISO: string) {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Apply one completion on `today` (a YYYY-MM-DD date in the user's timezone).
 *
 *   - first ever completion       → 1
 *   - second completion same day  → unchanged
 *   - the very next day           → +1
 *   - a single missed day, shield → +1, one shield spent
 *   - anything longer             → back to 1
 *
 * longest never decreases.
 */
export function applyCompletion(
  state: StreakState,
  today: string,
  options: StreakOptions = {},
): StreakResult {
  const shields = Math.max(0, options.shields ?? 0);

  if (!state.lastActiveDate) {
    return {
      current: 1,
      longest: Math.max(state.longest, 1),
      lastActiveDate: today,
      advanced: true,
      shieldUsed: false,
      shieldsLeft: shields,
    };
  }

  const gap = daysBetween(state.lastActiveDate, today);

  if (gap <= 0) {
    // already counted today — a second completion must not double-increment
    return { ...state, advanced: false, shieldUsed: false, shieldsLeft: shields };
  }

  if (gap === 1) {
    const current = state.current + 1;
    return {
      current,
      longest: Math.max(state.longest, current),
      lastActiveDate: today,
      advanced: true,
      shieldUsed: false,
      shieldsLeft: shields,
    };
  }

  if (gap === 2 && shields > 0) {
    const current = state.current + 1;
    return {
      current,
      longest: Math.max(state.longest, current),
      lastActiveDate: today,
      advanced: true,
      shieldUsed: true,
      shieldsLeft: shields - 1,
    };
  }

  return {
    current: 1,
    longest: Math.max(state.longest, state.current),
    lastActiveDate: today,
    advanced: false,
    shieldUsed: false,
    shieldsLeft: shields,
  };
}
