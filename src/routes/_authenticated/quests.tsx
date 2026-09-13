import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Hammer } from "lucide-react";

import { getPlayerState, postponeQuest } from "@/lib/player.functions";
import { QuestCard } from "@/components/chronicle/QuestCard";
import { QuestForge } from "@/components/chronicle/QuestForge";
import { EmptyState, ErrorNote, LoadingSheet } from "@/components/chronicle/States";
import { Button } from "@/components/ui/button";
import { SceneReveal } from "@/components/motion";
import { useCompleteQuest } from "@/hooks/useCompleteQuest";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quests")({
  head: () => ({
    meta: [
      { title: "Quests & Forge — Life RPG" },
      { name: "description", content: "Your active quest ledger and dynamic forge chamber." },
    ],
  }),
  component: QuestsPage,
});

type Filter = "open" | "done" | "all";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "open", label: "Active" },
  { key: "done", label: "Conquered" },
  { key: "all", label: "All" },
];

/**
 * The quest ledger.
 *
 * Rows arrive in sequence rather than as a block, so the eye is led down the
 * list in reading order. Changing the filter re-keys that sequence, which makes
 * switching views read as the ledger being re-dealt instead of the DOM silently
 * swapping rows. Rescoped children branch off their parent down a rail that
 * draws itself in — the split is shown being made, which is the one thing a
 * static list can never communicate.
 */
function QuestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [forgeOpen, setForgeOpen] = useState(false);
  const player = useQuery({ queryKey: ["player"], queryFn: () => getPlayerState() });
  const complete = useCompleteQuest();

  const postpone = useMutation({
    mutationFn: (questId: string) => postponeQuest({ data: { questId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["player"] }),
  });

  const quests = useMemo(() => {
    const all = player.data?.quests ?? [];
    const sorted = [...all].sort((a, b) => {
      const aDue = a.due_at ?? `${a.quest_date}T23:59:59`;
      const bDue = b.due_at ?? `${b.quest_date}T23:59:59`;
      return aDue.localeCompare(bDue);
    });
    if (filter === "open") return sorted.filter((q) => q.status === "pending");
    if (filter === "done") return sorted.filter((q) => q.status === "completed");
    return sorted;
  }, [player.data, filter]);

  const roots = quests.filter((q) => !q.parent_quest_id);
  const childrenOf = (parentId: string) =>
    (player.data?.quests ?? []).filter((q) => q.parent_quest_id === parentId);

  if (player.isLoading) return <LoadingSheet />;
  if (player.isError)
    return <ErrorNote message="Couldn't load your quests" onRetry={() => player.refetch()} />;

  return (
    <div className="space-y-6">
      <SceneReveal as="header" from="below">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="meta">Field registry</p>
            <h1 className="display text-2xl">Quests &amp; forge</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every quest binds a real habit into world progression.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter quests"
              className="flex rounded-lg bg-secondary/60 p-1"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={filter === option.key}
                  onClick={() => setFilter(option.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs tracking-wide uppercase transition-colors",
                    filter === option.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {!forgeOpen && (
              <Button size="sm" onClick={() => setForgeOpen(true)}>
                <Hammer className="size-4" aria-hidden />
                Forge quest
              </Button>
            )}
          </div>
        </div>
      </SceneReveal>

      {/* The forge opens into the page, pushing the ledger down beneath it. */}
      {forgeOpen && (
        <SceneReveal as="section" from="scale" duration={620} aria-label="Quest forge">
          <QuestForge onClose={() => setForgeOpen(false)} />
        </SceneReveal>
      )}

      {complete.error && (
        <ErrorNote message={complete.error} onRetry={() => complete.clearError()} inline />
      )}

      {roots.length === 0 ? (
        <SceneReveal from="scale">
          <EmptyState
            title={
              filter === "done" ? "No conquered objectives yet" : "Your realm awaits your will"
            }
            caption={
              filter === "done"
                ? "Completed quests are recorded here once you conquer them."
                : "No active objectives in this category. Open the forge to shape one."
            }
          />
        </SceneReveal>
      ) : (
        // Keyed on the filter so a view change re-deals the whole ledger.
        <ul key={filter} className="space-y-3">
          {roots.map((quest, index) => {
            const children = childrenOf(quest.id);
            return (
              <SceneReveal
                key={quest.id}
                as="li"
                from="below"
                delay={Math.min(420, index * 60)}
                className="space-y-3"
              >
                <QuestCard
                  quest={quest}
                  busy={complete.completingId === quest.id}
                  onComplete={() =>
                    complete.mutate({
                      questId: quest.id,
                      actualDurationMin: quest.est_duration_min,
                    })
                  }
                  {...(children.length === 0 && quest.status === "pending"
                    ? { onPostpone: () => postpone.mutate(quest.id) }
                    : {})}
                />

                {/* Branch: the rail draws down, then each child steps in off it. */}
                {children.length > 0 && (
                  <div className="relative ml-5 space-y-3 pt-1 pl-4 sm:ml-8 sm:pl-6">
                    <span
                      aria-hidden
                      className="animate-rail-draw absolute top-0 left-0 h-full w-px bg-primary/40"
                    />
                    <p className="meta">Rescoped into {children.length} steps</p>
                    {children.map((child, childIndex) => (
                      <SceneReveal key={child.id} from="left" delay={180 + childIndex * 100}>
                        <QuestCard
                          quest={child}
                          compact
                          isChild
                          busy={complete.completingId === child.id}
                          onComplete={() =>
                            complete.mutate({
                              questId: child.id,
                              actualDurationMin: child.est_duration_min,
                            })
                          }
                        />
                      </SceneReveal>
                    ))}
                  </div>
                )}
              </SceneReveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}
