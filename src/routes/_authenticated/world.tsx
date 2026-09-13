import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useMemo } from "react";
import { Plus, Sparkles } from "lucide-react";

import { getPlayerState, postponeQuest } from "@/lib/player.functions";
import { formatNumber } from "@/lib/game";
import { recommendQuest } from "@/engine/questRecommender";
import { ATTRIBUTES, ATTRIBUTE_ORDER, tierForXp, ZONE_TIERS } from "@/engine/gameRules";
import { PlayerHeader } from "@/components/game/PlayerHeader";
import { QuestCard } from "@/components/chronicle/QuestCard";
import { SmartQuestCard } from "@/components/chronicle/SmartQuestCard";
import { RescopeCard } from "@/components/chronicle/RescopeCard";
import { ErrorNote, LoadingSheet } from "@/components/chronicle/States";
import { Button } from "@/components/ui/button";
import { CountUp, Parallax, SceneReveal } from "@/components/motion";

import { useCompleteQuest } from "@/hooks/useCompleteQuest";
import { useRescope } from "@/hooks/useRescope";

const LifeWorldCanvas = lazy(() =>
  import("@/components/chronicle/LifeWorldCanvas").then((m) => ({ default: m.LifeWorldCanvas })),
);

export const Route = createFileRoute("/_authenticated/world")({
  head: () => ({
    meta: [
      { title: "Life World — Life RPG" },
      {
        name: "description",
        content: "Your living world territory, active quests, and attribute progression.",
      },
    ],
  }),
  component: World,
});

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

/**
 * The World is the room the player stands in, so it is composed as depth rather
 * than as a column of panels: the player header is the near layer, the world
 * canvas the middle distance (it drifts against the scroll), and the attribute
 * harmonics the far wall. Scrolling moves the camera down through those layers.
 *
 * Every surface is Hello Helper's `panel`; colour appears on text, chips and
 * bars only.
 */
function World() {
  const queryClient = useQueryClient();
  const player = useQuery({ queryKey: ["player"], queryFn: () => getPlayerState() });
  const complete = useCompleteQuest();
  const { accept, dismiss } = useRescope(player.data);

  const postpone = useMutation({
    mutationFn: (questId: string) => postponeQuest({ data: { questId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["player"] }),
  });

  const recommendation = useMemo(() => {
    if (!player.data) return null;
    return recommendQuest({
      quests: player.data.quests.map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        est_duration_min: q.est_duration_min,
        due_at: q.due_at,
        quest_date: q.quest_date,
        activity_key: q.activity_key,
        attribute: q.attribute,
        parent_quest_id: q.parent_quest_id,
      })),
      completions: player.data.completions,
      attributes: player.data.attributes,
    });
  }, [player.data]);

  if (player.isLoading) return <LoadingSheet />;
  if (player.isError || !player.data?.profile)
    return <ErrorNote message="Couldn't open your chronicle" onRetry={() => player.refetch()} />;

  const { profile, attributes, today, pendingRescope } = player.data;
  const entryNumber = String(profile.quests_completed + 1).padStart(3, "0");

  const openQuests = [...player.data.overdueQuests, ...player.data.todayQuests];
  const recommendedQuest = recommendation
    ? player.data.quests.find((q) => q.id === recommendation.quest.id)
    : undefined;
  const rescopeQuest = pendingRescope
    ? player.data.quests.find((q) => q.id === pendingRescope.quest_id)
    : undefined;
  const otherQuests = openQuests.filter((q) => q.id !== recommendedQuest?.id).slice(0, 4);

  return (
    <div className="space-y-10">
      {/* ------------------------------------------- near layer: the player */}
      <SceneReveal from="below" duration={760}>
        <p className="meta mb-3">
          Field Entry #{entryNumber} ·{" "}
          {DATE_FMT.format(new Date(`${today}T12:00:00`)).toUpperCase()} ·{" "}
          {greeting(new Date()).toUpperCase()}
        </p>
        <PlayerHeader
          displayName={profile.display_name || "Adventurer"}
          title={profile.title ?? undefined}
          sigil="◈"
          level={profile.level}
          xp={profile.xp}
          gold={profile.gold}
          streak={profile.current_streak}
        />
      </SceneReveal>

      {/* --------------------------------- middle distance: the territory */}
      <SceneReveal as="section" from="scale" duration={900} aria-label="Living world">
        <Parallax depth={-26}>
          <Suspense
            fallback={
              <div className="panel flex h-[420px] items-center justify-center">
                <span className="meta shimmer rounded px-3 py-1">Rendering realm territories…</span>
              </div>
            }
          >
            <LifeWorldCanvas
              attributes={attributes}
              level={profile.level}
              streak={profile.current_streak}
              height={460}
            />
          </Suspense>
        </Parallax>
      </SceneReveal>

      {/* Rescope interrupt — arrives from the side, because it interrupts */}
      {pendingRescope && (
        <SceneReveal as="section" from="left" aria-label="Quest rescope notice">
          <RescopeCard
            suggestion={pendingRescope}
            quest={rescopeQuest}
            busy={accept.isPending || dismiss.isPending}
            onAccept={(plan) => accept.mutate({ suggestionId: pendingRescope.id, plan })}
            onDismiss={() => dismiss.mutate(pendingRescope.id)}
          />
        </SceneReveal>
      )}

      {complete.error && (
        <ErrorNote message={complete.error} onRetry={() => complete.clearError()} inline />
      )}

      {/* ------------------------------------------------- today's quests */}
      <section className="space-y-4" aria-labelledby="quests-heading">
        <SceneReveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="meta">Action Matrix</p>
              <h2 id="quests-heading" className="display text-xl">
                Today&rsquo;s Field Quests
              </h2>
            </div>

            <Button asChild size="sm" variant="outline">
              <Link to="/quests">
                <Plus className="size-4" aria-hidden />
                Forge quest
              </Link>
            </Button>
          </div>
        </SceneReveal>

        {recommendedQuest && recommendation ? (
          <SceneReveal from="scale" delay={80}>
            <SmartQuestCard
              quest={recommendedQuest}
              scored={recommendation.scored}
              busy={complete.completingId === recommendedQuest.id}
              onComplete={() =>
                complete.mutate({
                  questId: recommendedQuest.id,
                  actualDurationMin: recommendedQuest.est_duration_min,
                })
              }
            />
          </SceneReveal>
        ) : openQuests.length === 0 ? (
          <SceneReveal from="scale">
            <div className="panel p-8 text-center">
              <div className="glow-gold mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary/60 text-primary">
                <Sparkles className="size-6" aria-hidden />
              </div>
              <h3 className="display text-lg">All field quests conquered</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Your realm rests in equilibrium. Open the Forge to shape new challenges for today.
              </p>
              <Button asChild className="mt-5">
                <Link to="/quests">Open quest forge</Link>
              </Button>
            </div>
          </SceneReveal>
        ) : null}

        {otherQuests.length > 0 && (
          <div className="space-y-3">
            <SceneReveal>
              <p className="meta">Additional active objectives ({otherQuests.length})</p>
            </SceneReveal>
            <ul className="space-y-3">
              {otherQuests.map((quest, index) => (
                <SceneReveal key={quest.id} as="li" from="below" delay={index * 70}>
                  <QuestCard
                    quest={quest}
                    compact
                    busy={complete.completingId === quest.id}
                    onComplete={() =>
                      complete.mutate({
                        questId: quest.id,
                        actualDurationMin: quest.est_duration_min,
                      })
                    }
                    onPostpone={() => postpone.mutate(quest.id)}
                  />
                </SceneReveal>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ------------------------------------------ far wall: the harmonics */}
      <SceneReveal as="section" from="below" duration={820} aria-labelledby="harmonics-heading">
        <Parallax depth={18}>
          <div className="panel p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="meta">Harmonics</p>
                <h2 id="harmonics-heading" className="display text-xl">
                  Attribute power
                </h2>
              </div>
              <span className="meta hidden sm:inline">4 sacred domains</span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ATTRIBUTE_ORDER.map((key, index) => {
                const meta = ATTRIBUTES[key];
                const xp = attributes[key];
                const tier = tierForXp(xp);
                const next = ZONE_TIERS[tier] ?? ZONE_TIERS[ZONE_TIERS.length - 1]!;
                const fill = Math.min(100, Math.round((xp / next) * 100));

                return (
                  <SceneReveal key={key} from="below" delay={index * 80}>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="display text-sm" style={{ color: meta.tone }}>
                          {meta.label}
                        </span>
                        <span className="meta">Tier {tier} of 4</span>
                      </div>

                      <div
                        className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/70"
                        role="progressbar"
                        aria-valuenow={fill}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${meta.label} tier progress`}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{ width: `${fill}%`, background: meta.tone }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          <CountUp value={xp} format={formatNumber} /> XP
                        </span>
                        <span>{meta.zone}</span>
                      </div>
                    </div>
                  </SceneReveal>
                );
              })}
            </div>
          </div>
        </Parallax>
      </SceneReveal>
    </div>
  );
}
