import { Flame } from "lucide-react";

import { CountUp } from "@/components/motion";
import { formatNumber, levelProgress } from "@/lib/game";
import { cn } from "@/lib/utils";

/**
 * Hello Helper's XP bar.
 *
 * The ZIP's spec exactly: h-3, bg-secondary/70 track, a primary→ember gradient
 * fill, and a 700ms width transition. That transition is the whole point — XP
 * awarded anywhere in the app is *seen* filling the bar here rather than
 * appearing already moved.
 */
export function XpBar({
  xp,
  compact = false,
  className,
}: {
  xp: number;
  compact?: boolean;
  className?: string;
}) {
  const p = levelProgress(xp);

  return (
    <div className={className}>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent}
        aria-label={`Level ${p.level} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-ember transition-[width] duration-700 ease-out"
          style={{ width: `${p.percent}%` }}
        />
      </div>
      {!compact ? (
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            {formatNumber(xp)} / {formatNumber(p.nextXp)} XP
          </span>
          <span>
            {formatNumber(p.remaining)} XP to level {p.level + 1}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hello Helper's PlayerHeader, carrying LifeRPG's profile.
 *
 * Structure is the ZIP's: one `panel`, a glow-gold sigil tile, display name and
 * level line, then a three-column <dl> of XP / Gold / Streak in the ZIP's own
 * `text-[10px] tracking-widest uppercase` caption style, with the XP bar
 * beneath. The only motion is the counters, which count to their value so a
 * completed quest is seen landing in the totals.
 */
export function PlayerHeader({
  displayName,
  title,
  sigil,
  level,
  xp,
  gold,
  streak,
  className,
}: {
  displayName: string;
  title?: string;
  sigil: string;
  level: number;
  xp: number;
  gold: number;
  streak: number;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="glow-gold flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary/60 text-3xl text-primary">
          <span aria-hidden>{sigil}</span>
        </div>

        {/*
          On a phone the three counters need the full width, so the identity
          block takes its own row rather than being squeezed until the name
          truncates to a single letter.
        */}
        <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
          <h1 className="display truncate text-2xl">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            Level {level}
            {title ? ` · “${title}”` : null}
          </p>
        </div>

        <dl className="grid w-full grid-cols-3 gap-4 text-center sm:w-auto sm:gap-6">
          <div>
            <dt className="meta">XP</dt>
            <dd className="display text-lg text-primary">
              <CountUp value={xp} format={formatNumber} />
            </dd>
          </div>
          <div>
            <dt className="meta">Gold</dt>
            <dd className="display text-lg">
              <CountUp value={gold} format={formatNumber} />
            </dd>
          </div>
          <div>
            <dt className="meta">Streak</dt>
            <dd className="display flex items-center justify-center gap-1 text-lg text-ember">
              <Flame className="size-4" aria-hidden />
              {streak}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5">
        <XpBar xp={xp} />
      </div>
    </section>
  );
}
