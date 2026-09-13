import { useState } from "react";
import { Check, ChevronDown, Clock, Loader2 } from "lucide-react";

import { DifficultyChip } from "@/components/game/DifficultyChip";
import { Button } from "@/components/ui/button";
import { activityMeta, ATTRIBUTES, type AttributeKey } from "@/engine/gameRules";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export type Quest = Database["public"]["Tables"]["quests"]["Row"];

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function questMeta(quest: Quest) {
  const due = quest.due_at ? new Date(quest.due_at) : new Date(`${quest.quest_date}T23:59:59`);
  return [
    quest.difficulty.toUpperCase(),
    `${quest.est_duration_min} MIN`,
    `DUE ${DATE_FMT.format(due).toUpperCase()}`,
  ].join(" · ");
}

/**
 * A quest, in Hello Helper's card language.
 *
 * Structure is the ZIP's QuestCard: a `panel` row — glyph tile, title, a single
 * line of meta, action on the right. The panel border stays neutral and colour
 * lives on the difficulty chip and the XP figure, which is how the ZIP keeps a
 * list of mixed quests calm.
 *
 * Motion is layered on top without altering that structure:
 *  - the row lifts a little toward the pointer, so it reads as an object lying
 *    on the page rather than a region of it;
 *  - the brief opens downward on request — secondary information is discovered,
 *    not dumped;
 *  - completing flies the reward up out of the row (the ZIP's own
 *    `animate-xp-fly`) before the row settles into its done state, so the
 *    cause is seen leaving the object and landing in the header totals.
 */
export function QuestCard({
  quest,
  onComplete,
  onPostpone,
  busy,
  compact = false,
  isChild = false,
}: {
  quest: Quest;
  onComplete: () => void;
  onPostpone?: () => void;
  busy?: boolean;
  compact?: boolean;
  isChild?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flying, setFlying] = useState(false);

  const attribute = (quest.attribute as AttributeKey) ?? "MIND";
  const tone = ATTRIBUTES[attribute]?.tone ?? "var(--primary)";
  const glyph = activityMeta(quest.activity_key)?.glyph ?? "◆";
  const done = quest.status === "completed";
  const hasDetail = Boolean(quest.description);
  const detailId = `quest-detail-${quest.id}`;

  return (
    <div
      className={cn(
        "panel group relative transition-transform duration-300",
        compact ? "p-3.5" : "p-4",
        done && "opacity-60",
        !done && "hover:-translate-y-0.5",
        isChild && "border-l-2 border-l-primary/40",
      )}
    >
      {/*
        The row wraps at phone width: the title block claims the rest of the
        first line so it never truncates to a few letters, and the actions drop
        to their own right-aligned line beneath it.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-lg"
          style={{ color: tone }}
        >
          <span aria-hidden>{glyph}</span>
        </div>

        <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-auto">
          <p className={cn("truncate font-medium", done && "line-through")}>{quest.title}</p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <DifficultyChip difficulty={quest.difficulty} />
            <span>{ATTRIBUTES[attribute]?.label ?? attribute}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {quest.est_duration_min}m
            </span>
            <span className="text-primary">+{quest.xp_reward} XP</span>
            <span>💰 {quest.gold_reward}</span>

            {hasDetail ? (
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={expanded}
                aria-controls={detailId}
                className="inline-flex items-center gap-0.5 underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                {expanded ? "less" : "brief"}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 transition-transform duration-300",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </div>
        </div>

        {flying ? (
          <span className="animate-xp-fly pointer-events-none absolute right-16 text-sm font-semibold text-primary">
            +{quest.xp_reward} XP
          </span>
        ) : null}

        {done ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-sm text-chart-5">
            <Check className="size-4" aria-hidden /> Done
          </span>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {onPostpone ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={onPostpone}>
                Postpone
              </Button>
            ) : null}
            <Button
              size="sm"
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
              Complete
            </Button>
          </div>
        )}
      </div>

      {/*
        Detail drawer. grid-rows 0fr -> 1fr animates height without measuring
        the content, so the reveal is smooth at any description length.
      */}
      {hasDetail ? (
        <div
          id={detailId}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            expanded ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <p className="border-l border-border pl-3 text-xs leading-relaxed text-muted-foreground">
              {quest.description}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
