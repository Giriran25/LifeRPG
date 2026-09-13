import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import {
  acceptRescope,
  dismissRescope,
  getPlayerState,
  saveRescopeSuggestion,
} from "@/lib/player.functions";
import { findRescopeCandidate, type RescopeQuest, type RescopeStage } from "@/engine/rescopeEngine";

type PlayerState = Awaited<ReturnType<typeof getPlayerState>>;

/**
 * Scoring runs on the client because it awards nothing. The moment it finds
 * something worth saying, the suggestion is persisted server-side — so the
 * rate limits, the outcome history and the accept path all live in Postgres.
 */
export function useRescope(player: PlayerState | undefined) {
  const queryClient = useQueryClient();
  const raised = useRef<string | null>(null);

  const candidate = useMemo(() => {
    if (!player?.profile) return null;
    if (player.pendingRescope) return null;

    const quests: RescopeQuest[] = player.quests
      .filter((q) => q.status === "pending")
      .map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        est_duration_min: q.est_duration_min,
        due_at: q.due_at,
        quest_date: q.quest_date,
        created_at: q.created_at,
        times_postponed: q.times_postponed,
        deadline_external: q.deadline_external,
        parent_quest_id: q.parent_quest_id,
        xp_reward: q.xp_reward,
        gold_reward: q.gold_reward,
      }));

    return findRescopeCandidate({ quests, completions: player.completions }, player.rescopeHistory);
  }, [player]);

  const save = useMutation({
    mutationFn: (vars: Parameters<typeof saveRescopeSuggestion>[0]) => saveRescopeSuggestion(vars),
    onSuccess: (result) => {
      if (result.suggestion) void queryClient.invalidateQueries({ queryKey: ["player"] });
    },
  });

  // Raise at most one suggestion per candidate per session; the server-side
  // rate limit is the real guard, this just avoids a redundant round trip.
  useEffect(() => {
    if (!candidate) return;
    if (raised.current === candidate.questId) return;
    raised.current = candidate.questId;
    save.mutate({
      data: {
        questId: candidate.questId,
        riskScore: Number(candidate.risk.toFixed(3)),
        intervention: candidate.intervention,
        plan: candidate.plan,
        rationale: candidate.rationale,
        engineVersion: candidate.engineVersion,
      },
    });
    // save is a stable mutation object from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate]);

  const accept = useMutation({
    mutationFn: (vars: { suggestionId: string; plan: RescopeStage[] | null }) =>
      acceptRescope({ data: { suggestionId: vars.suggestionId, plan: vars.plan } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["player"] }),
  });

  const dismiss = useMutation({
    mutationFn: (suggestionId: string) => dismissRescope({ data: { suggestionId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["player"] }),
  });

  return { candidate, accept, dismiss, saving: save.isPending };
}

/** Pending suggestions, straight from Postgres. */
export function usePendingRescope() {
  return useQuery({
    queryKey: ["rescope"],
    queryFn: () => getPlayerState().then((state) => state.pendingRescope),
  });
}
