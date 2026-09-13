import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { Check, X } from "lucide-react";

import { getDayDetail, getProgress } from "@/lib/player.functions";
import { formatNumber } from "@/lib/game";
import { MILESTONES } from "@/engine/gameRules";
import { ErrorNote, LoadingSheet } from "@/components/chronicle/States";
import { Button } from "@/components/ui/button";
import { CountUp, Parallax, SceneReveal } from "@/components/motion";
import { cn } from "@/lib/utils";

const LedgerHeatmap = lazy(() =>
  import("@/components/chronicle/LedgerHeatmap").then((m) => ({ default: m.LedgerHeatmap })),
);

export const Route = createFileRoute("/_authenticated/chronicle")({
  head: () => ({
    meta: [
      { title: "Chronicle & Ledger — Life RPG" },
      {
        name: "description",
        content: "Your personal history: every logged day, earned seal, and milestone.",
      },
    ],
  }),
  component: ChroniclePage,
});

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * The Chronicle reads as a record being consulted, not an analytics dashboard.
 *
 * The week figures count up as they arrive, so the summary lands rather than
 * being present from the first frame. Selecting a day opens an inspector
 * directly beneath the ledger it came from — the evidence stays spatially
 * attached to the record it was pulled out of — and its entries step in one at
 * a time as they are read out.
 */
function ChroniclePage() {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const progress = useQuery({ queryKey: ["progress"], queryFn: () => getProgress() });
  const dayDetail = useQuery({
    queryKey: ["day", selectedDay],
    queryFn: () => getDayDetail({ data: { day: selectedDay as string } }),
    enabled: Boolean(selectedDay),
  });

  if (progress.isLoading) return <LoadingSheet rows={2} />;
  if (progress.isError || !progress.data)
    return (
      <ErrorNote message="Couldn't open the chronicle ledger" onRetry={() => progress.refetch()} />
    );

  const { activity, unlocked, week, today, profile } = progress.data;
  const level = profile?.level ?? 1;

  return (
    <div className="space-y-8">
      <SceneReveal as="header" from="below">
        <p className="meta">Field records</p>
        <h1 className="display text-2xl">Chronicle &amp; ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The living history of what you actually did — authenticated evidence of your real-life
          actions.
        </p>
      </SceneReveal>

      {/* Week summary — figures count into place, left to right */}
      <section aria-label="Seven day summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Entries (7 days)" delay={0}>
          <CountUp value={week.quests} format={formatNumber} />
        </Figure>
        <Figure label="XP earned (7 days)" delay={70} tone="var(--primary)">
          <CountUp value={week.xp} format={formatNumber} />
        </Figure>
        <Figure label="Peak day" delay={140}>
          {week.bestDayCount ? `${week.bestDayCount} quests` : "—"}
        </Figure>
        <Figure
          label="Vs last week"
          delay={210}
          tone={
            week.changePercent !== null && week.changePercent >= 0
              ? "var(--chart-5)"
              : "var(--ember)"
          }
        >
          {week.changePercent === null
            ? "—"
            : `${week.changePercent > 0 ? "+" : ""}${week.changePercent}%`}
        </Figure>
      </section>

      {/* The ledger itself, drifting slightly against the scroll */}
      <SceneReveal as="section" from="scale" duration={860} aria-labelledby="heatmap-heading">
        <Parallax depth={-18}>
          <div className="panel p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="meta">Daily stamping record</p>
                <h2 id="heatmap-heading" className="display text-xl">
                  Twelve-week activity
                </h2>
              </div>
              <span className="meta hidden sm:inline">Select a day to inspect</span>
            </div>

            <Suspense
              fallback={
                <p className="meta p-8 text-center">
                  <span className="shimmer rounded px-3 py-1">Ruling ledger lines…</span>
                </p>
              }
            >
              <LedgerHeatmap
                today={today}
                activity={activity}
                weeks={12}
                selectedDay={selectedDay}
                onSelectDay={(day) => setSelectedDay(day === selectedDay ? null : day)}
              />
            </Suspense>
          </div>
        </Parallax>
      </SceneReveal>

      {/* Day inspector — opens directly under the ledger it was pulled from */}
      {selectedDay && (
        <SceneReveal
          as="section"
          from="below"
          duration={520}
          aria-live="polite"
          aria-label="Day evidence"
        >
          <div className="panel glow-gold p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="meta">Evidence inspection</p>
                <h3 className="display text-xl">
                  {LONG_DATE.format(new Date(`${selectedDay}T12:00:00`))}
                </h3>
              </div>

              <Button
                size="icon"
                variant="ghost"
                aria-label="Close day inspection"
                onClick={() => setSelectedDay(null)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            {dayDetail.isLoading ? (
              <p className="meta py-6 text-center">
                <span className="shimmer rounded px-3 py-1">Unrolling archived seals…</span>
              </p>
            ) : dayDetail.data ? (
              <div className="mt-4 space-y-5">
                <SceneReveal from="left">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 text-primary">
                      +{dayDetail.data.activity?.xp_earned ?? 0} XP
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5">
                      💰 {dayDetail.data.activity?.gold_earned ?? 0}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {dayDetail.data.quests.length} logged tasks
                    </span>
                  </div>
                </SceneReveal>

                {dayDetail.data.quests.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No quests were logged on this date.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dayDetail.data.quests.map((q, index) => (
                      <SceneReveal key={q.quest_id} as="li" from="left" delay={index * 80}>
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Check className="size-4 shrink-0 text-chart-5" aria-hidden />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{q.title}</p>
                              <p className="meta">
                                {q.attribute ?? "GENERAL"} · {q.category}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm text-primary">+{q.xp_awarded} XP</span>
                        </div>
                      </SceneReveal>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </SceneReveal>
      )}

      {/* Milestones, in Hello Helper's badge language */}
      <SceneReveal as="section" from="below" duration={820} aria-labelledby="milestones-heading">
        <div className="panel p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="meta">{unlocked.length} claimed to date</p>
              <h2 id="milestones-heading" className="display text-xl">
                Hall of milestones
              </h2>
            </div>
            <span className="meta">Level {level}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {MILESTONES.map((ms, index) => {
              const earned = level >= ms.level;
              return (
                <SceneReveal key={ms.code} from="scale" delay={index * 70}>
                  <div
                    className={cn(
                      "panel w-36 p-3 text-center transition-transform duration-300",
                      earned ? "glow-gold hover:-translate-y-1" : "opacity-50",
                    )}
                  >
                    <div
                      className={cn("text-3xl", earned ? "text-primary" : "text-muted-foreground")}
                      aria-hidden
                    >
                      {earned ? "◈" : "◇"}
                    </div>
                    <p className="mt-1 text-sm font-medium">{ms.name}</p>
                    <p className="text-xs text-muted-foreground">{ms.unlocks}</p>
                    <p className="meta mt-2">
                      {earned ? "Claimed" : `Unlocks at level ${ms.level}`}
                    </p>
                  </div>
                </SceneReveal>
              );
            })}
          </div>
        </div>
      </SceneReveal>
    </div>
  );
}

/** One week-summary figure. Counts into place as the row arrives. */
function Figure({
  label,
  children,
  delay = 0,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  delay?: number;
  tone?: string;
}) {
  return (
    <SceneReveal from="below" delay={delay}>
      <div className="panel h-full p-4">
        <p className="meta">{label}</p>
        <p className="display mt-1 text-2xl" style={tone ? { color: tone } : undefined}>
          {children}
        </p>
      </div>
    </SceneReveal>
  );
}
