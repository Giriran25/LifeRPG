import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Quest = Database["public"]["Tables"]["quests"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type UnlockedBadge = {
  code: string;
  name: string;
  emoji: string;
  description: string;
  gold_reward: number;
};

/**
 * The mutation boundary.
 *
 * Anything that touches xp, gold, level, streak, attributes or inventory goes
 * through a security-definer RPC — never through a table write from here.
 * Read-side scoring (questRecommender, assessQuestRisk) is free to run on the
 * client because it awards nothing.
 */

const difficulty = z.enum(["easy", "medium", "hard", "epic"]);
const attribute = z.enum(["FOCUS", "BODY", "MIND", "CRAFT"]);

const questInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).nullable().optional(),
  category: z.string().trim().min(1).max(40).default("General"),
  difficulty: difficulty.default("medium"),
  goal_id: z.string().uuid().nullable().optional(),
  source: z.string().max(30).default("manual"),
  recovered_from: z.string().uuid().nullable().optional(),
  activity_key: z.string().max(30).nullable().optional(),
  attribute: attribute.nullable().optional(),
  est_duration_min: z.number().int().min(5).max(480).default(30),
  due_at: z.string().datetime().nullable().optional(),
  deadline_external: z.boolean().default(false),
});

const planStage = z.object({
  title: z.string().trim().min(2).max(160),
  est_duration_min: z.number().int().min(5).max(480),
  reward_xp: z.number().int().min(0).max(100000),
  reward_gold: z.number().int().min(0).max(100000),
  due_at: z.string().nullable().optional(),
});

function daysAgoISO(today: string, days: number) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The player's authoritative dashboard state. */
export const getPlayerState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: todayRow } = await supabase.rpc("user_today", { p_user: userId });
    const today = (todayRow as unknown as string) ?? new Date().toISOString().slice(0, 10);

    const [profileRes, questsRes, effectsRes, completionRes, rescopeRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("quests")
        .select("*")
        .eq("user_id", userId)
        .gte("quest_date", daysAgoISO(today, 30))
        .order("created_at", { ascending: true }),
      supabase.from("player_effects").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("quest_completions")
        .select("quest_id, day, xp_awarded, category, completed_at")
        .eq("user_id", userId)
        .gte("day", daysAgoISO(today, 60))
        .order("completed_at", { ascending: true }),
      supabase
        .from("rescope_suggestions")
        .select("*")
        .eq("user_id", userId)
        .order("suggested_at", { ascending: false })
        .limit(30),
    ]);

    // Self-heal: accounts created before the profile trigger (or via an odd
    // path) must still get a character sheet on first load.
    let profile = profileRes.data;
    if (!profile) {
      const created = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("*")
        .maybeSingle();
      profile = created.data;
    }

    const quests = questsRes.data ?? [];
    const completions = completionRes.data ?? [];

    // The recommender needs measured durations against activity keys, which
    // live on the quest rather than the completion row.
    const questById = new Map(quests.map((q) => [q.id, q]));
    const scoredCompletions = completions.map((c) => ({
      activity_key: questById.get(c.quest_id)?.activity_key ?? null,
      actual_duration_min: questById.get(c.quest_id)?.actual_duration_min ?? null,
      completed_at: c.completed_at,
    }));

    const suggestions = rescopeRes.data ?? [];

    return {
      today,
      profile,
      quests,
      todayQuests: quests.filter((q) => q.quest_date === today && q.status === "pending"),
      overdueQuests: quests.filter((q) => q.quest_date < today && q.status === "pending"),
      completions: scoredCompletions,
      completedToday: completions.filter((c) => c.day === today).length,
      attributes: {
        FOCUS: profile?.focus_xp ?? 0,
        BODY: profile?.body_xp ?? 0,
        MIND: profile?.mind_xp ?? 0,
        CRAFT: profile?.craft_xp ?? 0,
      },
      effects: effectsRes.data ?? { streak_shields: 0, user_id: userId },
      pendingRescope: suggestions.find((s) => s.outcome === "PENDING") ?? null,
      rescopeHistory: suggestions.map((s) => ({
        quest_id: s.quest_id,
        outcome: s.outcome,
        suggested_at: s.suggested_at,
        responded_at: s.responded_at,
      })),
    };
  });

export const completeQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        questId: z.string().uuid(),
        actualDurationMin: z.number().int().min(0).max(1440).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("complete_quest", {
      p_quest_id: data.questId,
      p_actual_duration_min: data.actualDurationMin ?? null,
    });
    if (error) throw new Error(error.message);
    return result as unknown as {
      xp_awarded: number;
      gold_awarded: number;
      leveled_up: boolean;
      previous_level: number;
      old_level: number;
      new_level: number;
      unlocked: UnlockedBadge[];
      new_badges: UnlockedBadge[];
      attribute: string | null;
      attribute_total: number;
      streak: number;
      on_time: boolean;
      anomalous: boolean;
      parent_completed: boolean;
      profile: Profile;
    };
  });

export const createQuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ quests: z.array(questInput).min(1).max(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: todayRow } = await supabase.rpc("user_today", { p_user: userId });
    const today = (todayRow as unknown as string) ?? new Date().toISOString().slice(0, 10);

    const rows = data.quests.map((q) => ({
      user_id: userId,
      title: q.title,
      description: q.description ?? null,
      category: q.category,
      difficulty: q.difficulty,
      goal_id: q.goal_id ?? null,
      recovered_from: q.recovered_from ?? null,
      source: q.source,
      quest_date: today,
      activity_key: q.activity_key ?? null,
      attribute: q.attribute ?? null,
      est_duration_min: q.est_duration_min,
      due_at: q.due_at ?? null,
      deadline_external: q.deadline_external,
    }));

    const { data: inserted, error } = await supabase.from("quests").insert(rows).select();
    if (error) throw new Error(error.message);

    const recovered = data.quests.map((q) => q.recovered_from).filter(Boolean) as string[];
    if (recovered.length) {
      await supabase
        .from("quests")
        .update({ status: "skipped" })
        .eq("user_id", userId)
        .in("id", recovered);
    }
    return { quests: inserted ?? [] };
  });

export const postponeQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ questId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: quest } = await supabase
      .from("quests")
      .select("times_postponed, due_at, quest_date")
      .eq("user_id", userId)
      .eq("id", data.questId)
      .maybeSingle();
    if (!quest) throw new Error("Quest not found");

    const base = quest.due_at ? new Date(quest.due_at) : new Date(`${quest.quest_date}T20:00:00`);
    base.setDate(base.getDate() + 1);

    const { error } = await supabase
      .from("quests")
      .update({ times_postponed: quest.times_postponed + 1, due_at: base.toISOString() })
      .eq("user_id", userId)
      .eq("id", data.questId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissQuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ questIds: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quests")
      .update({ status: "skipped" })
      .eq("user_id", context.userId)
      .in("id", data.questIds);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ questId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quests")
      .delete()
      .eq("user_id", context.userId)
      .eq("id", data.questId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().trim().min(2).max(30).optional(),
        avatar_emoji: z.string().max(16).optional(),
        timezone: z.string().max(60).optional(),
        is_public: z.boolean().optional(),
        reduced_motion: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.avatar_emoji !== undefined) patch.avatar_emoji = data.avatar_emoji;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.is_public !== undefined) patch.is_public = data.is_public;
    if (data.reduced_motion !== undefined) patch.reduced_motion = data.reduced_motion;
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { profile };
  });

/**
 * Onboarding commits once, at the end: profile fields, activity rows, reward
 * preferences, the onboarding flag and the generated quests all land in a
 * single transaction or none of them do.
 */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        profile: z.object({
          display_name: z.string().trim().min(2).max(30),
          full_name: z.string().trim().max(60).optional(),
          avatar_emoji: z.string().max(16).optional(),
          main_goal: z.string().max(40).optional(),
          timezone: z.string().max(60).optional(),
          reward_prefs: z.array(z.string().max(30)).max(3).default([]),
        }),
        activities: z
          .array(
            z.object({
              activity_key: z.string().max(30),
              config: z.record(z.string(), z.unknown()).default({}),
            }),
          )
          .max(8),
        quests: z
          .array(
            z.object({
              title: z.string().trim().min(2).max(120),
              description: z.string().max(400).nullable().optional(),
              category: z.string().max(40).default("General"),
              difficulty: difficulty.default("medium"),
              activity_key: z.string().max(30).nullable().optional(),
              attribute: attribute.nullable().optional(),
              est_duration_min: z.number().int().min(5).max(480),
            }),
          )
          .min(1)
          .max(4),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("complete_onboarding", {
      p_profile: data.profile as unknown as Json,
      p_activities: data.activities as unknown as Json,
      p_quests: data.quests as unknown as Json,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { profile: Profile; quests: Quest[] };
  });

export const checkUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(3).max(24) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: available, error } = await context.supabase.rpc("username_available", {
      p_username: data.username,
    });
    if (error) throw new Error(error.message);
    return { available: Boolean(available) };
  });

// ---------------------------------------------------------------------------
// Rescoping
// ---------------------------------------------------------------------------

export const getRescopeSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rescope_suggestions")
      .select("*")
      .eq("user_id", context.userId)
      .eq("outcome", "PENDING")
      .order("suggested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { suggestions: data ?? [] };
  });

/** Persists a suggestion produced by client-side scoring. Awards nothing. */
export const saveRescopeSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        questId: z.string().uuid(),
        riskScore: z.number().min(0).max(1),
        intervention: z.enum(["SPLIT", "SHRINK", "RESCHEDULE", "EXTEND"]),
        plan: z.array(planStage).min(1).max(4),
        rationale: z.string().trim().min(4).max(400),
        engineVersion: z.string().max(30).default("rescope-v1"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Server-side rate limit, mirroring the engine: one per quest per 24h.
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: recent } = await supabase
      .from("rescope_suggestions")
      .select("id, quest_id")
      .eq("user_id", userId)
      .gte("suggested_at", since);
    if ((recent ?? []).some((r) => r.quest_id === data.questId))
      return { suggestion: null, skipped: "already suggested for this quest today" };
    if ((recent ?? []).length >= 3) return { suggestion: null, skipped: "daily limit reached" };

    const { data: inserted, error } = await supabase
      .from("rescope_suggestions")
      .insert({
        user_id: userId,
        quest_id: data.questId,
        risk_score: data.riskScore,
        intervention: data.intervention,
        plan: data.plan as unknown as Json,
        rationale: data.rationale,
        engine_version: data.engineVersion,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { suggestion: inserted, skipped: null };
  });

export const acceptRescope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        suggestionId: z.string().uuid(),
        plan: z.array(planStage).min(1).max(6).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const args: { p_suggestion_id: string; p_plan?: Json } = {
      p_suggestion_id: data.suggestionId,
    };
    // Only send a plan when the user edited one; otherwise the stored plan wins.
    if (data.plan) args.p_plan = data.plan as unknown as Json;
    const { data: result, error } = await context.supabase.rpc("accept_rescope", args);
    if (error) throw new Error(error.message);
    return result as unknown as {
      parent_id: string;
      children: Quest[];
      xp_preserved: number;
      gold_preserved: number;
    };
  });

export const dismissRescope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ suggestionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dismiss_rescope", {
      p_suggestion_id: data.suggestionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export const getRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [itemsRes, inventoryRes, profileRes] = await Promise.all([
      supabase.from("items").select("*").order("sort_order"),
      supabase.from("inventory").select("*").eq("user_id", userId),
      supabase.from("profiles").select("gold, reward_prefs").eq("id", userId).maybeSingle(),
    ]);
    return {
      items: itemsRes.data ?? [],
      inventory: inventoryRes.data ?? [],
      gold: profileRes.data?.gold ?? 0,
      rewardPrefs: profileRes.data?.reward_prefs ?? [],
    };
  });

export const purchaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemCode: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("purchase_item", {
      p_item_code: data.itemCode,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { profile: Profile; item: Item };
  });

// ---------------------------------------------------------------------------
// Chronicle
// ---------------------------------------------------------------------------

/** Heatmap + weekly summary + badges for the Chronicle screen. */
export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: todayRow } = await supabase.rpc("user_today", { p_user: userId });
    const today = (todayRow as unknown as string) ?? new Date().toISOString().slice(0, 10);

    const [activityRes, achRes, unlockedRes, weekRes, prevWeekRes, profileRes] = await Promise.all([
      supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", userId)
        .gte("day", daysAgoISO(today, 364)),
      supabase.from("achievements").select("*").order("sort_order"),
      supabase.from("user_achievements").select("code, unlocked_at").eq("user_id", userId),
      supabase
        .from("quest_completions")
        .select("day, category, xp_awarded, completed_at")
        .eq("user_id", userId)
        .gte("day", daysAgoISO(today, 6)),
      supabase
        .from("daily_activity")
        .select("xp_earned, quests_completed")
        .eq("user_id", userId)
        .gte("day", daysAgoISO(today, 13))
        .lte("day", daysAgoISO(today, 7)),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);

    const week = weekRes.data ?? [];
    const weekXp = week.reduce((s, c) => s + c.xp_awarded, 0);
    const prevWeekXp = (prevWeekRes.data ?? []).reduce((s, d) => s + d.xp_earned, 0);

    const byDay = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const c of week) {
      byDay.set(c.day, (byDay.get(c.day) ?? 0) + 1);
      byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
    }
    const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      today,
      profile: profileRes.data,
      activity: activityRes.data ?? [],
      achievements: achRes.data ?? [],
      unlocked: unlockedRes.data ?? [],
      week: {
        quests: week.length,
        xp: weekXp,
        bestDay: bestDay ? bestDay[0] : null,
        bestDayCount: bestDay ? bestDay[1] : 0,
        topCategory: topCategory ? topCategory[0] : null,
        changePercent:
          prevWeekXp > 0 ? Math.round(((weekXp - prevWeekXp) / prevWeekXp) * 100) : null,
      },
    };
  });

export const getDayDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [completions, activity] = await Promise.all([
      supabase
        .from("quest_completions")
        .select("xp_awarded, gold_awarded, category, quest_id, completed_at")
        .eq("user_id", userId)
        .eq("day", data.day),
      supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", userId)
        .eq("day", data.day)
        .maybeSingle(),
    ]);
    const ids = (completions.data ?? []).map((c) => c.quest_id);
    const { data: quests } = ids.length
      ? await supabase
          .from("quests")
          .select("id, title, category, difficulty, attribute, due_at, completed_at")
          .in("id", ids)
      : {
          data: [] as Array<{
            id: string;
            title: string;
            category: string;
            difficulty: string;
            attribute: string | null;
            due_at: string | null;
            completed_at: string | null;
          }>,
        };
    return {
      day: data.day,
      activity: activity.data,
      quests: (completions.data ?? []).map((c) => {
        const quest = quests?.find((q) => q.id === c.quest_id);
        return {
          ...c,
          title: quest?.title ?? "Quest",
          attribute: quest?.attribute ?? null,
          on_time: !quest?.due_at || !quest.completed_at || quest.completed_at <= quest.due_at,
        };
      }),
    };
  });
