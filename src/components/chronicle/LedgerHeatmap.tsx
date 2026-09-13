import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type ActivityRow = {
  day: string;
  quests_completed: number;
  xp_earned: number;
  gold_earned: number;
};

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });

/**
 * Hello Helper's five intensity steps, unchanged: an empty cell is a flat
 * secondary tint, effort climbs through chart-5, and the busiest days land on
 * primary. Colour alone carries the value — the ZIP never prints a number in
 * the cell, which is what keeps a twelve-week grid readable at 11px.
 */
const LEVEL_CLASSES = [
  "bg-secondary/50",
  "bg-chart-5/30",
  "bg-chart-5/55",
  "bg-primary/60",
  "bg-primary",
];

function intensity(xp: number) {
  if (xp <= 0) return 0;
  if (xp < 60) return 1;
  if (xp < 150) return 2;
  if (xp < 300) return 3;
  return 4;
}

/** Monday-first columns covering `weeks` whole weeks ending today. */
function buildWeeks(today: string, weeks: number) {
  const end = new Date(`${today}T12:00:00`);
  const weekday = (end.getDay() + 6) % 7; // Monday = 0
  const lastMonday = new Date(end);
  lastMonday.setDate(end.getDate() - weekday);

  const columns: string[][] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const column: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(lastMonday);
      date.setDate(lastMonday.getDate() - w * 7 + d);
      column.push(date.toISOString().slice(0, 10));
    }
    columns.push(column);
  }
  return columns;
}

/**
 * The twelve-week ledger.
 *
 * The only motion is the ZIP's own: a cell scales up under the pointer, and the
 * selected day keeps a primary ring. That restraint is deliberate — this grid
 * is ~84 interactive targets, so anything more would turn scanning it into
 * noise. The reveal happens one level up, where the whole panel arrives.
 */
export function LedgerHeatmap({
  today,
  activity,
  weeks = 12,
  onSelectDay,
  selectedDay,
}: {
  today: string;
  activity: ActivityRow[];
  weeks?: number;
  onSelectDay: (day: string) => void;
  selectedDay: string | null;
}) {
  const byDay = useMemo(() => new Map(activity.map((row) => [row.day, row])), [activity]);
  const columns = useMemo(() => buildWeeks(today, weeks), [today, weeks]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-[3px]">
          {columns.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day) => {
                const row = byDay.get(day);
                const xp = row?.xp_earned ?? 0;
                const count = row?.quests_completed ?? 0;
                const future = day > today;
                const selected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={future}
                    onClick={() => onSelectDay(day)}
                    aria-pressed={selected}
                    aria-label={`${LONG_DATE.format(new Date(`${day}T12:00:00`))}: ${count} ${
                      count === 1 ? "quest" : "quests"
                    }, ${xp} XP`}
                    title={`${day} · ${count} quests · ${xp} XP`}
                    className={cn(
                      "size-[13px] rounded-[3px] transition-transform duration-150",
                      "hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      future ? "opacity-20" : LEVEL_CLASSES[intensity(xp)],
                      selected && "scale-125 ring-2 ring-primary",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Less</span>
          {LEVEL_CLASSES.map((c, i) => (
            <span key={i} aria-hidden className={cn("size-[13px] rounded-[3px]", c)} />
          ))}
          <span>More</span>
        </div>
        <span>Select any past day to inspect its evidence</span>
      </div>
    </div>
  );
}
