import { cn } from "@/lib/utils";

/**
 * Hello Helper's difficulty chip, unchanged.
 *
 * The ZIP maps difficulty — not attribute — onto the accent tokens, and it
 * colours the chip's text and border only, never a surface. LifeRPG's
 * quest_difficulty enum is the same four values, so this map is the ZIP's
 * `difficultyStyles` verbatim.
 */
const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "text-chart-5 border-chart-5/40",
  medium: "text-accent border-accent/40",
  hard: "text-ember border-ember/40",
  epic: "text-arcane border-arcane/40",
};

export function DifficultyChip({
  difficulty,
  className,
}: {
  difficulty: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 tracking-wide uppercase",
        DIFFICULTY_STYLES[difficulty] ?? "",
        className,
      )}
    >
      {difficulty}
    </span>
  );
}

export { DIFFICULTY_STYLES };
