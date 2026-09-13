import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Compass,
  Flame,
  Hammer,
  HeartPulse,
  Milestone,
  Scroll,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding } from "@/lib/player.functions";
import { browserTimezone } from "@/lib/game";
import {
  ACTIVITIES,
  MAIN_GOALS,
  REWARD_PREFS,
  type ActivityKey,
  ACTIVITY_ATTRIBUTE_MAP,
} from "@/engine/gameRules";
import { ACTIVITY_SCHEMAS, defaultConfigFor, type ActivityConfig } from "@/engine/activitySchemas";
import { generateStarterQuests } from "@/engine/questGenerator";
import { Button } from "@/components/ui/button";
import { AmbientField, SceneReveal } from "@/components/motion";
import { QuestionRenderer } from "@/components/chronicle/QuestionRenderer";
import { AvatarSigil, SIGIL_KEYS } from "@/components/chronicle/AvatarSigil";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Character Creation Forge — Life RPG" }] }),
  component: Onboarding,
});

type State = {
  step: number;
  displayName: string;
  sigil: string;
  mainGoal: string;
  selected: ActivityKey[];
  configs: Partial<Record<ActivityKey, ActivityConfig>>;
  rewardPrefs: string[];
};

type Action =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: number }
  | { type: "displayName"; value: string }
  | { type: "sigil"; value: string }
  | { type: "mainGoal"; value: string }
  | { type: "toggleActivity"; key: ActivityKey }
  | { type: "config"; key: ActivityKey; field: string; value: string | number | string[] }
  | { type: "toggleReward"; value: string };

const TOTAL_STEPS = 6;
const STEP_LABELS = ["Identity", "Purpose", "Territory", "Configuration", "Tribute", "The Forge"];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "next":
      return { ...state, step: Math.min(TOTAL_STEPS, state.step + 1) };
    case "back":
      return { ...state, step: Math.max(1, state.step - 1) };
    case "goto":
      return { ...state, step: action.step };
    case "displayName":
      return { ...state, displayName: action.value };
    case "sigil":
      return { ...state, sigil: action.value };
    case "mainGoal":
      return { ...state, mainGoal: action.value };
    case "toggleActivity": {
      const has = state.selected.includes(action.key);
      const selected = has
        ? state.selected.filter((k) => k !== action.key)
        : [...state.selected, action.key];
      const configs = { ...state.configs };
      if (has) delete configs[action.key];
      else configs[action.key] = defaultConfigFor(action.key);
      return { ...state, selected, configs };
    }
    case "config":
      return {
        ...state,
        configs: {
          ...state.configs,
          [action.key]: { ...state.configs[action.key], [action.field]: action.value },
        },
      };
    case "toggleReward": {
      const has = state.rewardPrefs.includes(action.value);
      if (has)
        return { ...state, rewardPrefs: state.rewardPrefs.filter((v) => v !== action.value) };
      if (state.rewardPrefs.length >= 3) return state;
      return { ...state, rewardPrefs: [...state.rewardPrefs, action.value] };
    }
    default:
      return state;
  }
}

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    displayName: "",
    sigil: "compass",
    mainGoal: "discipline",
    selected: ["CODING", "WALKING", "MEDITATION"],
    configs: {
      CODING: defaultConfigFor("CODING"),
      WALKING: defaultConfigFor("WALKING"),
      MEDITATION: defaultConfigFor("MEDITATION"),
    },
    rewardPrefs: ["progress"],
  });
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, string> | undefined;
      const suggested = meta?.["full_name"] || meta?.["display_name"] || meta?.["username"] || "";
      if (suggested) dispatch({ type: "displayName", value: suggested });
    });
  }, []);

  const quests = useMemo(
    () =>
      generateStarterQuests(
        state.selected.map((key) => ({
          activity_key: key,
          config: state.configs[key] ?? defaultConfigFor(key),
        })),
      ),
    [state.selected, state.configs],
  );

  const commit = useMutation({
    mutationFn: () =>
      completeOnboarding({
        data: {
          profile: {
            display_name: state.displayName.trim() || "Adventurer",
            avatar_emoji: state.sigil,
            main_goal: state.mainGoal,
            timezone: browserTimezone(),
            reward_prefs: state.rewardPrefs,
          },
          activities: state.selected.map((key) => ({
            activity_key: key,
            config: (state.configs[key] ?? defaultConfigFor(key)) as Record<string, unknown>,
          })),
          quests: quests.map((q) => ({
            title: q.title,
            description: q.description,
            category: q.category,
            difficulty: q.difficulty,
            activity_key: q.activity_key,
            attribute: q.attribute,
            est_duration_min: q.est_duration_min,
          })),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["player"] });
      void navigate({ to: "/world" });
    },
    onError: () => setError("Couldn't forge your world. Please check connection and try again."),
  });

  const surveyKeys = state.selected;
  const currentSurveyKey = surveyKeys[surveyIndex];

  /**
   * Which way the player is travelling, so the next scene enters from the side
   * they came from rather than always from the right.
   */
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");

  function advance() {
    setError(null);
    setStepDirection("forward");
    if (state.step === 1 && !state.displayName.trim()) {
      setError("Your character requires an alias or name.");
      return;
    }
    if (state.step === 3 && state.selected.length === 0) {
      setError("Claim at least one territory to begin.");
      return;
    }
    if (state.step === 4) {
      if (surveyIndex < surveyKeys.length - 1) {
        setSurveyIndex(surveyIndex + 1);
        return;
      }
    }
    if (state.step === 5 && state.rewardPrefs.length === 0) {
      setError("Select at least one reward preference.");
      return;
    }
    dispatch({ type: "next" });
  }

  function retreat() {
    setError(null);
    setStepDirection("back");
    if (state.step === 4 && surveyIndex > 0) {
      setSurveyIndex(surveyIndex - 1);
      return;
    }
    dispatch({ type: "back" });
  }

  // Count active attributes based on selected activities
  const activeAttributes = useMemo(() => {
    const set = new Set<string>();
    state.selected.forEach((act) => {
      const attr = ACTIVITY_ATTRIBUTE_MAP[act];
      if (attr) set.add(attr);
    });
    return set;
  }, [state.selected]);

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col lg:flex-row overflow-x-hidden">
      {/* Same environment as the gate and the landing — one continuous space. */}
      <AmbientField intensity={0.75} />

      {/* LEFT COLUMN: Character & World Construction Manifest (Desktop) */}
      <aside className="relative hidden lg:flex lg:w-5/12 flex-col justify-between border-r border-border/40 bg-card/20 p-10 overflow-hidden">
        {/* Top brand */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/50 bg-primary/10">
              <Compass className="h-4 w-4 text-primary" />
            </div>
            <span className="display text-sm font-bold tracking-widest text-foreground uppercase">
              Life RPG
            </span>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold">
            Forge: Step {state.step} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Live Constructing Character Card */}
        <div className="relative z-10 my-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Real-Time Character Manifest
          </p>

          <div className="rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-xl shadow-2xl">
            {/* Sigil & Name */}
            <div className="flex items-center gap-4 border-b border-border/40 pb-5">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/50 bg-secondary/40 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
                <AvatarSigil sigil={state.sigil} size={40} tone="var(--primary)" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="display text-xl font-bold uppercase truncate text-foreground">
                  {state.displayName.trim() || "Adventurer"}
                </h3>
                <p className="text-xs font-mono text-primary uppercase mt-0.5">
                  {MAIN_GOALS.find((g) => g.key === state.mainGoal)?.label ?? "Discipline"} · Level
                  01
                </p>
              </div>
            </div>

            {/* Living Territories Illuminated */}
            <div className="mt-5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Resonant World Sectors ({activeAttributes.size} of 4)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-300",
                    activeAttributes.has("MIND")
                      ? "border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)] shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_20%,transparent)]"
                      : "border-border/30 bg-secondary/10 text-muted-foreground/40",
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>The Great Library</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-300",
                    activeAttributes.has("FOCUS")
                      ? "border-[color-mix(in_oklab,var(--arcane)_50%,transparent)] bg-[color-mix(in_oklab,var(--arcane)_14%,transparent)] text-[var(--arcane)] shadow-[0_0_12px_color-mix(in_oklab,var(--arcane)_20%,transparent)]"
                      : "border-border/30 bg-secondary/10 text-muted-foreground/40",
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Sanctuary</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-300",
                    activeAttributes.has("BODY")
                      ? "border-[color-mix(in_oklab,var(--success)_50%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-[var(--success)] shadow-[0_0_12px_color-mix(in_oklab,var(--success)_20%,transparent)]"
                      : "border-border/30 bg-secondary/10 text-muted-foreground/40",
                  )}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>Training Arena</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-300",
                    activeAttributes.has("CRAFT")
                      ? "border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-[var(--primary)] shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                      : "border-border/30 bg-secondary/10 text-muted-foreground/40",
                  )}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Artisan Forge</span>
                </div>
              </div>
            </div>

            {/* Selected activities count */}
            <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Claimed Activities: {state.selected.length}</span>
              <span className="text-primary">Starter Quests: {quests.length}</span>
            </div>
          </div>
        </div>

        {/* Left footer */}
        <div className="relative z-10 text-xs font-mono text-muted-foreground/60 uppercase">
          Continuous World Sync Enabled
        </div>
      </aside>

      {/* RIGHT COLUMN: Interactive Forge Sequence */}
      <main className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-14 max-w-2xl mx-auto w-full">
        {/* Step Progress Rail */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            <span>
              Phase 0{state.step} · {STEP_LABELS[state.step - 1]}
            </span>
            <span className="text-primary font-bold">
              {Math.round((state.step / TOTAL_STEPS) * 100)}% FORGED
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-[var(--primary)] transition-all duration-500 shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
              style={{ width: `${(state.step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/*
          Each step is a scene. The entry direction follows the direction of
          travel — forward steps arrive from the right, Back brings the previous
          step in from the left — so the sequence reads as lateral movement
          through the forge rather than a panel redrawing in place.
        */}
        <SceneReveal
          key={`${state.step}-${surveyIndex}`}
          from={stepDirection === "back" ? "left" : "right"}
          duration={520}
          className="my-auto py-8"
        >
          {state.step === 1 && <StepIdentity state={state} dispatch={dispatch} />}
          {state.step === 2 && <StepPurpose state={state} dispatch={dispatch} />}
          {state.step === 3 && <StepTerritory state={state} dispatch={dispatch} />}
          {state.step === 4 && currentSurveyKey && (
            <StepSurvey
              activityKey={currentSurveyKey}
              index={surveyIndex}
              total={surveyKeys.length}
              config={state.configs[currentSurveyKey] ?? defaultConfigFor(currentSurveyKey)}
              dispatch={dispatch}
            />
          )}
          {state.step === 5 && <StepTribute state={state} dispatch={dispatch} />}
          {state.step === 6 && (
            <StepForge
              quests={quests}
              name={state.displayName}
              pending={commit.isPending}
              onDone={() => commit.mutate()}
            />
          )}

          {error && (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {error}
            </p>
          )}
        </SceneReveal>

        {/* Bottom Actions */}
        <footer className="flex items-center justify-between gap-4 border-t border-border pt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={retreat}
            disabled={state.step === 1 && surveyIndex === 0}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>

          {state.step < TOTAL_STEPS ? (
            <Button onClick={advance}>
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
              <Sparkles className="size-4" aria-hidden />
              {commit.isPending ? "Awakening world…" : "Enter your world"}
            </Button>
          )}
        </footer>
      </main>
    </div>
  );
}

function StepIdentity({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Genesis</p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          Define Your Identity
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Who walks this path? Name your character and select your personal sigil.
        </p>
      </div>

      <div>
        <label
          htmlFor="charname"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2"
        >
          Character Name / Alias
        </label>
        <input
          id="charname"
          value={state.displayName}
          onChange={(e) => dispatch({ type: "displayName", value: e.target.value })}
          placeholder="e.g. Ranjith or Knight of Solitude"
          className="w-full rounded-xl border border-border/80 bg-secondary/20 px-4 py-3.5 display text-xl text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          autoComplete="nickname"
        />
      </div>

      <div>
        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-3">
          Choose Your Sigil
        </label>
        <div
          role="group"
          aria-label="Choose a sigil"
          className="grid grid-cols-4 sm:grid-cols-6 gap-3"
        >
          {SIGIL_KEYS.map((key) => {
            const active = state.sigil === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch({ type: "sigil", value: key })}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-200",
                  active
                    ? "border-primary bg-primary/20 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_30%,transparent)] scale-105"
                    : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40",
                )}
              >
                <AvatarSigil
                  sigil={key}
                  size={36}
                  tone={active ? "var(--primary)" : "var(--foreground)"}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepPurpose({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Direction</p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          Declare Your Purpose
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          What is the primary virtue anchoring your character this season?
        </p>
      </div>

      <div role="group" aria-label="Main goal" className="space-y-3">
        {MAIN_GOALS.map((goal) => {
          const active = state.mainGoal === goal.key;
          return (
            <button
              key={goal.key}
              type="button"
              aria-pressed={active}
              onClick={() => dispatch({ type: "mainGoal", value: goal.key })}
              className={cn(
                "group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all duration-200",
                active
                  ? "border-primary bg-primary/15 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40",
              )}
            >
              <div>
                <span className="display text-base font-bold uppercase tracking-wide text-foreground group-hover:text-primary transition-colors">
                  {goal.label}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{goal.caption}</p>
              </div>
              <div
                className={cn(
                  "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {active && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepTerritory({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">
          Habit Matrix
        </p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          Claim Your Territories
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Select the real-life activities you want converted into quests.
        </p>
      </div>

      <div role="group" aria-label="Activities" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACTIVITIES.map((activity) => {
          const active = state.selected.includes(activity.key);
          const isDeep = ["CODING", "WALKING", "MEDITATION"].includes(activity.key);
          return (
            <button
              key={activity.key}
              type="button"
              aria-pressed={active}
              onClick={() => dispatch({ type: "toggleActivity", key: activity.key })}
              className={cn(
                "relative rounded-xl border p-4 text-left transition-all duration-200",
                active
                  ? "border-primary bg-primary/15 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)] scale-[1.01]"
                  : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40",
              )}
            >
              {isDeep && (
                <span className="absolute top-3 right-3 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-primary/40 bg-primary/20 text-primary">
                  Core
                </span>
              )}
              <span className="display block text-2xl" aria-hidden>
                {activity.glyph}
              </span>
              <span className="display mt-2 block text-sm font-bold uppercase text-foreground">
                {activity.label}
              </span>
              <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                {activity.caption}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepSurvey({
  activityKey,
  index,
  total,
  config,
  dispatch,
}: {
  activityKey: ActivityKey;
  index: number;
  total: number;
  config: ActivityConfig;
  dispatch: React.Dispatch<Action>;
}) {
  const activity = ACTIVITIES.find((a) => a.key === activityKey);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">
          Configuration · {index + 1} of {total}
        </p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          {activity?.label} Protocol
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Tune the cadence, targets, and parameters for this activity.
        </p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/40 p-6 backdrop-blur-md">
        {ACTIVITY_SCHEMAS[activityKey].map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            value={config[question.id]}
            onChange={(value) =>
              dispatch({ type: "config", key: activityKey, field: question.id, value })
            }
          />
        ))}
      </div>
    </section>
  );
}

function StepTribute({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">
          Treasury Affinity
        </p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          Choose Desired Rewards
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick 1–3 reward preferences that motivate your daily discipline.
        </p>
      </div>

      <div role="group" aria-label="Reward preferences" className="grid gap-3 sm:grid-cols-2">
        {REWARD_PREFS.map((pref) => {
          const active = state.rewardPrefs.includes(pref.key);
          return (
            <button
              key={pref.key}
              type="button"
              aria-pressed={active}
              onClick={() => dispatch({ type: "toggleReward", value: pref.key })}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200",
                active
                  ? "border-primary bg-primary/15 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40",
              )}
            >
              <div>
                <span className="display block text-sm font-bold uppercase text-foreground">
                  {pref.label}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  {pref.caption}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>{active ? "Affinity Selected" : "Tap to Select"}</span>
                {active && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepForge({
  quests,
  name,
  pending,
  onDone,
}: {
  quests: ReturnType<typeof generateStarterQuests>;
  name: string;
  pending: boolean;
  onDone: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(reduced ? quests.length : 0);

  useEffect(() => {
    if (reduced) {
      setRevealed(quests.length);
      return;
    }
    setRevealed(0);
    const timers = quests.map((_, i) =>
      setTimeout(() => setRevealed((current) => Math.max(current, i + 1)), 400 + i * 500),
    );
    return () => timers.forEach(clearTimeout);
  }, [quests, reduced]);

  const done = revealed >= quests.length;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Activation</p>
        <h2 className="display text-3xl font-bold uppercase tracking-tight text-foreground">
          {done ? "Your World is Stamped" : "Forging Starter Quests…"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {done
            ? `Three bespoke starter quests are forged for ${name || "adventurer"}.`
            : "Binding your habits into living quests…"}
        </p>
      </div>

      <ul className="space-y-3.5">
        {quests.map((quest, i) => (
          <li
            key={quest.title}
            className={cn(
              "panel flex items-center gap-4 p-4 transition-all duration-500",
              i < revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            )}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-lg text-primary"
            >
              ◈
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{quest.title}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{quest.attribute}</span>
                <span aria-hidden>·</span>
                <span>{quest.est_duration_min} min</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
