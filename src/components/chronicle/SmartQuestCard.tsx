import { useState } from "react";
import { Check, ChevronDown, Clock, HelpCircle, Loader2 } from "lucide-react";

import { type Quest } from "./QuestCard";
import { DifficultyChip } from "@/components/game/DifficultyChip";
import { Button } from "@/components/ui/button";
import { ATTRIBUTES, activityMeta, type AttributeKey } from "@/engine/gameRules";
import type { ScoredQuest } from "@/engine/questRecommender";
import { cn } from "@/lib/utils";

/**
 * The recommended quest — the one object on the World page that is allowed to
 * be louder than the rest.
 *
 * It is still Hello Helper's `panel` and still the same row anatomy as every
 * other quest; the only difference is scale and a `glow-gold`, which is the
 * ZIP's own way of marking the primary object (it does the same on the player
 * sigil). Priority is expressed by emphasis, not by a second card style.
 *
 * "Why this quest" is the page's main act of visual discovery: the recommender's
 * reasoning stays hidden until asked for, then the signal weights draw
 * themselves in as bars so the score is read as a shape rather than a number.
 */
export function SmartQuestCard({
  quest,
  scored,
  onComplete,
  busy,
}: {
  quest: Quest;
  scored: ScoredQuest;
  onComplete: () => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [flying, setFlying] = useState(false);

  const attribute = (quest.attribute as AttributeKey) ?? "MIND";
  const attrMeta = ATTRIBUTES[attribute] ?? ATTRIBUTES.MIND;
  const glyph = activityMeta(quest.activity_key)?.glyph ?? "◆";

  return (
    <section aria-labelledby="smart-quest-title" className="panel glow-gold relative p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <p className="meta text-primary">Priority field recommendation</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          <span>{quest.est_duration_min}m</span>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-2xl"
          style={{ color: attrMeta.tone }}
        >
          <span aria-hidden>{glyph}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="smart-quest-title" className="display text-xl">
            {quest.title}
          </h2>
          {quest.description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {quest.description}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <DifficultyChip difficulty={quest.difficulty} />
            <span>{attrMeta.zone}</span>
            <span className="text-primary">+{quest.xp_reward} XP</span>
            <span>💰 {quest.gold_reward}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="why-this-quest"
        >
          <HelpCircle className="size-4" aria-hidden />
          Why this quest
          <ChevronDown
            aria-hidden
            className={cn("size-3 transition-transform duration-300", open && "rotate-180")}
          />
        </Button>

        <Button
          disabled={busy}
          onClick={() => {
            setFlying(true);
            window.setTimeout(() => setFlying(false), 900);
            onComplete();
          }}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {busy ? "Sealing…" : "Complete"}
        </Button>
      </div>

      {/* Reasoning drawer — height animates without measuring the content */}
      <div
        id="why-this-quest"
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl bg-secondary/40 p-4">
            <p className="meta mb-2">Recommender rationale</p>
            <p className="mb-4 text-sm leading-relaxed">“{scored.rationale}”</p>

            <p className="meta mb-2">Signal weight breakdown</p>
            <ul className="space-y-2">
              {scored.breakdown.map((term, index) => {
                const magnitude = Math.min(1, Math.abs(term.weighted) / 0.3);
                const negative = term.weight < 0;
                return (
                  <li key={term.term} className="flex items-center gap-3 text-xs">
                    <span className="w-32 shrink-0 truncate text-muted-foreground">
                      {term.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/70">
                      {/*
                        Bars grow only once the drawer is open, so the weights
                        are seen being measured out rather than pre-drawn.
                      */}
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700 ease-out",
                          negative ? "bg-destructive" : "bg-primary",
                        )}
                        style={{
                          width: open ? `${Math.max(10, magnitude * 100)}%` : "0%",
                          transitionDelay: `${index * 60}ms`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-12 shrink-0 text-right",
                        negative ? "text-destructive" : "text-primary",
                      )}
                    >
                      {term.weighted >= 0 ? "+" : "−"}
                      {Math.abs(term.weighted).toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Recommendation index</span>
              <span className="text-primary">{scored.score.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {flying ? (
        <span className="animate-xp-fly pointer-events-none absolute top-4 right-16 text-sm font-semibold text-primary">
          +{quest.xp_reward} XP
        </span>
      ) : null}
    </section>
  );
}
