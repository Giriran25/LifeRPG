export type Difficulty = "easy" | "medium" | "hard" | "epic";

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  easy: 25,
  medium: 50,
  hard: 100,
  epic: 250,
};

export const DIFFICULTY_GOLD: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 20,
  epic: 50,
};

export const CATEGORIES = [
  { name: "Coding", emoji: "💻" },
  { name: "DSA", emoji: "🧠" },
  { name: "Fitness", emoji: "💪" },
  { name: "Reading", emoji: "📖" },
  { name: "Study", emoji: "🎓" },
  { name: "Career", emoji: "🚀" },
  { name: "Mind", emoji: "🧘" },
  { name: "General", emoji: "⚔️" },
] as const;

export function categoryEmoji(category: string) {
  return CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase())?.emoji ?? "⚔️";
}

/** Cumulative XP required to reach a level. Mirrors public.xp_for_level. */
export function xpForLevel(level: number) {
  const l = Math.max(1, level);
  return 25 * (l - 1) * l;
}

/** Mirrors public.level_for_xp. */
export function levelForXp(xp: number) {
  const safe = Math.max(0, xp);
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * safe) / 25)) / 2));
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const floorXp = xpForLevel(level);
  const nextXp = xpForLevel(level + 1);
  const span = nextXp - floorXp;
  const into = xp - floorXp;
  return {
    level,
    into,
    span,
    nextXp,
    remaining: Math.max(0, nextXp - xp),
    percent: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
  };
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n ?? 0);
}

export function localDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
