import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { completeQuest, getPlayerState } from "@/lib/player.functions";
import { levelForXp } from "@/lib/game";
import { useCelebration } from "@/components/chronicle/Celebration";
import { useOnlineStatus } from "@/components/chronicle/OfflineBanner";
import { applyCompletion } from "@/engine/streakEngine";
import type { AttributeKey } from "@/engine/gameRules";

type PlayerState = Awaited<ReturnType<typeof getPlayerState>>;

/**
 * Optimistic completion.
 *
 * The XP, gold and level shown the instant you tap come from src/lib/game.ts,
 * the client mirror of the SQL curve. The celebration — level-up, seals — only
 * ever plays on the server's response, so nothing is ever celebrated falsely.
 */
export function useCompleteQuest() {
  const queryClient = useQueryClient();
  const { celebrate } = useCelebration();
  const online = useOnlineStatus();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { questId: string; actualDurationMin?: number | null }) => {
      if (!online) throw new Error("OFFLINE");
      return completeQuest({
        data: { questId: vars.questId, actualDurationMin: vars.actualDurationMin ?? null },
      });
    },

    onMutate: async (vars) => {
      setError(null);
      setCompletingId(vars.questId);
      await queryClient.cancelQueries({ queryKey: ["player"] });
      const previous = queryClient.getQueryData<PlayerState>(["player"]);

      queryClient.setQueryData<PlayerState>(["player"], (state) => {
        if (!state?.profile) return state;
        const quest = state.quests.find((q) => q.id === vars.questId);
        if (!quest) return state;

        const xp = state.profile.xp + quest.xp_reward;
        const streak = applyCompletion(
          {
            current: state.profile.current_streak,
            longest: state.profile.longest_streak,
            lastActiveDate: state.profile.last_active_date,
          },
          state.today,
          { shields: state.effects.streak_shields ?? 0 },
        );

        const attribute = quest.attribute as AttributeKey | null;

        return {
          ...state,
          profile: {
            ...state.profile,
            xp,
            gold: state.profile.gold + quest.gold_reward,
            level: levelForXp(xp),
            current_streak: streak.current,
            longest_streak: streak.longest,
            last_active_date: streak.lastActiveDate,
            quests_completed: state.profile.quests_completed + 1,
          },
          quests: state.quests.map((q) =>
            q.id === vars.questId
              ? { ...q, status: "completed" as const, completed_at: new Date().toISOString() }
              : q,
          ),
          todayQuests: state.todayQuests.filter((q) => q.id !== vars.questId),
          overdueQuests: state.overdueQuests.filter((q) => q.id !== vars.questId),
          completedToday: state.completedToday + 1,
          attributes: attribute
            ? { ...state.attributes, [attribute]: state.attributes[attribute] + quest.xp_reward }
            : state.attributes,
        };
      });

      return { previous };
    },

    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["player"], context.previous);
      setError(
        err instanceof Error && err.message === "OFFLINE"
          ? "You're offline — this didn't save."
          : "Couldn't save your progress.",
      );
      setCompletingId(null);
    },

    onSuccess: (result) => {
      // Everything below is the server's word, not the client's guess.
      if (result.leveled_up) {
        const unlocks = result.profile?.title ? `Now titled ${result.profile.title}` : null;
        celebrate({
          kind: "level",
          fromLevel: result.old_level ?? result.previous_level,
          toLevel: result.new_level,
          ...(unlocks ? { unlocks } : {}),
        });
      }
      const badges = result.new_badges ?? result.unlocked ?? [];
      if (badges.length) celebrate({ kind: "badge", badges });

      celebrate({
        kind: "entry",
        text: `Entry logged · +${result.xp_awarded} XP · +${result.gold_awarded} coins`,
      });
    },

    onSettled: () => {
      setCompletingId(null);
      void queryClient.invalidateQueries({ queryKey: ["player"] });
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      void queryClient.invalidateQueries({ queryKey: ["rewards"] });
    },
  });

  return { ...mutation, completingId, error, clearError: () => setError(null), online };
}
