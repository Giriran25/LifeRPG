import { useState } from "react";
import { Check, GitBranch, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SceneReveal } from "@/components/motion";
import { allocate, type RescopeStage } from "@/engine/rescopeEngine";
import type { Quest } from "./QuestCard";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Suggestion = Database["public"]["Tables"]["rescope_suggestions"]["Row"];

const INTERVENTION_COPY: Record<string, string> = {
  SHRINK: "Duration scaled down so the quest fits the day you actually have.",
  RESCHEDULE: "Moved into tomorrow's roster, protecting the chain.",
  EXTEND: "Window widened so the work can be done deliberately.",
};

/**
 * Rescope — adapt the task, not the trophy.
 *
 * For a SPLIT the whole point is that one quest *becomes* several, so the card
 * shows that happening spatially: the parent sits at the top, a rail draws down
 * out of it, and the children step in off that rail one after another. The
 * reward line underneath reconciles to the parent's total, which is what makes
 * the promise legible — the trophy did not shrink, only the steps.
 *
 * Rebalancing here is presentation of a plan the player may edit before
 * accepting; the server remains the authority on what is finally awarded.
 */
export function RescopeCard({
  suggestion,
  quest,
  onAccept,
  onDismiss,
  busy,
}: {
  suggestion: Suggestion;
  quest: Quest | undefined;
  onAccept: (plan: RescopeStage[] | null) => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const stages = (suggestion.plan as unknown as RescopeStage[]) ?? [];
  const isSplit = suggestion.intervention === "SPLIT";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RescopeStage[]>(stages);

  /**
   * Spreads the parent's XP and gold across the edited stages in proportion to
   * their minutes, keeping the sum exactly equal to the parent's.
   */
  function rebalance(next: RescopeStage[]): RescopeStage[] {
    const totalXp = stages.reduce((s, p) => s + p.reward_xp, 0);
    const totalGold = stages.reduce((s, p) => s + p.reward_gold, 0);
    const totalMinutes = next.reduce((s, p) => s + Math.max(1, p.est_duration_min), 0);
    const weights = next.map((p) => Math.max(1, p.est_duration_min) / totalMinutes);
    const xp = allocate(totalXp, weights);
    const gold = allocate(totalGold, weights);
    return next.map((stage, i) => ({
      ...stage,
      reward_xp: xp[i] ?? 0,
      reward_gold: gold[i] ?? 0,
    }));
  }

  function updateStage(index: number, patch: Partial<RescopeStage>) {
    setDraft((current) =>
      rebalance(current.map((stage, i) => (i === index ? { ...stage, ...patch } : stage))),
    );
  }

  const shown = editing ? draft : stages;
  const totalXp = shown.reduce((s, p) => s + p.reward_xp, 0);
  const totalGold = shown.reduce((s, p) => s + p.reward_gold, 0);

  return (
    <section aria-labelledby="rescope-title" className="panel glow-gold p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-primary">
            <GitBranch className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="meta text-primary">Adapt the task, not the trophy</p>
            <h2 id="rescope-title" className="display text-lg">
              This quest may be too large
            </h2>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss suggestion"
          disabled={busy}
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-4">
        <p className="text-sm leading-relaxed">{suggestion.rationale}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Objective: <span className="text-foreground">{quest?.title ?? "Current quest"}</span>
        </p>
      </div>

      {isSplit ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="meta">Proposed breakdown</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? "Reset plan" : "Tune steps"}
            </Button>
          </div>

          {/* Parent */}
          <div className="panel p-3.5">
            <p className="meta">Root objective</p>
            <p className="truncate font-medium">{quest?.title ?? "Target quest"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="text-primary">{totalXp} XP</span> · 💰 {totalGold} total
            </p>
          </div>

          {/* The branch being made: rail draws down, children step off it */}
          <div className="relative mt-3 space-y-3 pl-6">
            <span
              aria-hidden
              className="animate-rail-draw absolute top-0 left-2 h-full w-px bg-primary/40"
            />
            {shown.map((stage, index) => (
              <SceneReveal key={index} from="left" delay={140 + index * 120}>
                <div className="panel relative p-3.5">
                  <span aria-hidden className="absolute top-1/2 -left-4 h-px w-4 bg-primary/40" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="meta">Step {index + 1}</p>
                    <p className="meta">{stage.est_duration_min} min</p>
                  </div>

                  {editing ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        value={stage.title}
                        aria-label={`Step ${index + 1} title`}
                        onChange={(e) => updateStage(index, { title: e.target.value })}
                      />
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`stage-min-${index}`}
                          className="text-xs text-muted-foreground"
                        >
                          Minutes
                        </label>
                        <Input
                          id={`stage-min-${index}`}
                          type="number"
                          min={5}
                          max={240}
                          className="w-24"
                          value={stage.est_duration_min}
                          onChange={(e) =>
                            updateStage(index, {
                              est_duration_min: Math.max(5, Number(e.target.value)),
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 font-medium">{stage.title}</p>
                  )}

                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="text-primary">+{stage.reward_xp} XP</span> · 💰{" "}
                    {stage.reward_gold}
                  </p>
                </div>
              </SceneReveal>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-chart-5">
            <Check className="size-3.5" aria-hidden />
            Steps reconcile to the parent&rsquo;s full reward
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-secondary/40 p-4">
          <p className="meta mb-1 text-primary">Proposed: {suggestion.intervention}</p>
          <p className="text-sm text-muted-foreground">
            {INTERVENTION_COPY[suggestion.intervention] ?? "An adjustment to keep this achievable."}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDismiss}>
          Keep original
        </Button>

        <Button disabled={busy} onClick={() => onAccept(isSplit ? shown : null)}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {busy ? "Reconfiguring…" : `Accept ${suggestion.intervention.toLowerCase()}`}
        </Button>
      </div>
    </section>
  );
}
