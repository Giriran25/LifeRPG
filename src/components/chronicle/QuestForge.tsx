import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock, Hammer, Loader2, X } from "lucide-react";

import { DifficultyChip } from "@/components/game/DifficultyChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SceneReveal } from "@/components/motion";
import { createQuests } from "@/lib/player.functions";
import { friendlyError } from "@/lib/error-message";
import {
  ACTIVITIES,
  ACTIVITY_ATTRIBUTE_MAP,
  ATTRIBUTES,
  activityMeta,
  type ActivityKey,
  type AttributeKey,
} from "@/engine/gameRules";
import { cn } from "@/lib/utils";

/**
 * The four difficulties the quest contract accepts.
 *
 * player.functions.ts validates difficulty as z.enum(["easy","medium","hard",
 * "epic"]), so those are the only four offered here — the frontend conforms to
 * the existing contract rather than the contract bending to the UI.
 */
const DIFFICULTIES = ["easy", "medium", "hard", "epic"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const STAGES = ["choose", "shape", "tune", "forge"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  choose: "Choose",
  shape: "Shape",
  tune: "Tune",
  forge: "Forge",
};

const SUGGESTIONS: Record<ActivityKey, string[]> = {
  CODING: [
    "Solve 2 algorithm practice problems",
    "45-minute focus sprint on project architecture",
    "Read 1 chapter of systems design",
  ],
  WALKING: [
    "8,000 outdoor steps",
    "Morning 30-minute brisk walk",
    "Evening stride and post-work reset",
  ],
  MEDITATION: [
    "15-minute morning stillness",
    "Box breathing reset between sprints",
    "Evening breath sanctuary",
  ],
  GYM: ["Full body compound session", "Core and mobility circuit", "Zone 2 cardio"],
  SLEEP: ["Wind-down ritual by 10:30pm", "8 hours restorative sleep", "Digital sunset before bed"],
  JOBS: [
    "Submit 2 tailored applications",
    "Refactor resume portfolio",
    "Reach out to 1 industry peer",
  ],
  SAVING: [
    "Review weekly discretionary spend",
    "Transfer 15% to treasury",
    "No-unnecessary-purchases day",
  ],
  CLEAN_ROOM: ["Desk and workspace reset", "15-minute tidying", "Organise physical notes"],
};

/**
 * The forge — the one place in the product where an object is built in front of
 * the player rather than simply appearing.
 *
 * The choreography is the point. A preview row sits under the controls for the
 * whole sequence and assembles part by part: choosing a domain lights its
 * glyph, shaping writes the title in, tuning fills the duration, difficulty and
 * reward line, and forging materialises the finished object. Because the
 * preview is the same `panel` row the quest will become in the ledger, the last
 * stage reads as the object being released into the world rather than a form
 * being submitted.
 *
 * Static UI throughout is Hello Helper: one panel, shadcn controls, colour on
 * chips and figures only.
 */
export function QuestForge({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>("choose");
  const [activity, setActivity] = useState<ActivityKey | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(45);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [error, setError] = useState<string | null>(null);

  const attribute = activity
    ? ((ACTIVITY_ATTRIBUTE_MAP[activity] as AttributeKey) ?? "MIND")
    : null;
  const attrMeta = attribute ? ATTRIBUTES[attribute] : null;
  const glyph = activity ? (activityMeta(activity)?.glyph ?? "◆") : "◇";

  const create = useMutation({
    mutationFn: () =>
      createQuests({
        data: {
          quests: [
            {
              title: title.trim(),
              description: description.trim() || undefined,
              category: ACTIVITIES.find((a) => a.key === activity)?.category ?? "General",
              difficulty,
              activity_key: activity as ActivityKey,
              attribute: attribute as AttributeKey,
              est_duration_min: duration,
              source: "manual",
              deadline_external: false,
            },
          ],
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["player"] });
      onCreated?.();
      onClose();
    },
    /*
     * Surface what actually went wrong. A blanket "please try again" hides the
     * difference between an expired session, a validation rejection and a
     * permission error — all of which need different action from the player,
     * and none of which they can diagnose from a generic string.
     */
    onError: (err) => {
      console.error("createQuests failed", err);
      setError(friendlyError(err, "Forging that quest"));
    },
  });

  const stageIndex = STAGES.indexOf(stage);

  /**
   * What the current stage still needs, or null when it is ready.
   *
   * A disabled Continue with no explanation is indistinguishable from a broken
   * button, so the requirement is stated next to it rather than left implicit.
   */
  const blocker =
    stage === "choose" && !activity
      ? "Pick a domain to continue"
      : stage === "shape" && title.trim().length < 2
        ? "Name the quest to continue"
        : null;
  const canAdvance = blocker === null && stage !== "forge";

  function selectActivity(key: ActivityKey) {
    setActivity(key);
    if (!title) setTitle(SUGGESTIONS[key]?.[0] ?? "");
  }

  return (
    <div className="panel p-5 sm:p-6">
      {/* Header + stage rail */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="glow-gold flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-primary">
            <Hammer className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="display text-lg">Quest forge</h2>
            <p className="meta">
              Step {stageIndex + 1} of 4 · {STAGE_LABEL[stage]}
            </p>
          </div>
        </div>

        <Button size="icon" variant="ghost" aria-label="Close forge" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {/* The rail fills as the object is built — progress you can see. */}
      <ol className="mt-4 flex gap-2" aria-label="Forge progress">
        {STAGES.map((s, i) => (
          <li key={s} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors duration-500",
                i <= stageIndex ? "bg-primary" : "bg-secondary/70",
              )}
            />
            <span
              className={cn(
                "meta mt-1.5 block transition-colors",
                i === stageIndex && "text-primary",
              )}
              aria-current={i === stageIndex ? "step" : undefined}
            >
              {STAGE_LABEL[s]}
            </span>
          </li>
        ))}
      </ol>

      {/* Stage content — each stage arrives from the direction of travel */}
      <SceneReveal key={stage} from="right" duration={480} className="mt-6">
        {stage === "choose" ? (
          <div className="space-y-4">
            <div>
              <p className="meta">Domain</p>
              <h3 className="display text-xl">Which part of real life is this?</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACTIVITIES.map((act) => {
                const selected = activity === act.key;
                const tone = ATTRIBUTES[ACTIVITY_ATTRIBUTE_MAP[act.key] as AttributeKey]?.tone;
                return (
                  <button
                    key={act.key}
                    type="button"
                    onClick={() => selectActivity(act.key)}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all duration-200",
                      "hover:-translate-y-0.5",
                      selected
                        ? "border-primary bg-secondary/60"
                        : "border-border bg-secondary/25 hover:bg-secondary/45",
                    )}
                  >
                    <span className="text-2xl" style={{ color: tone }} aria-hidden>
                      {activityMeta(act.key)?.glyph ?? "◆"}
                    </span>
                    <span className="text-xs font-medium">{act.label}</span>
                    <span className="meta">{act.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {stage === "shape" ? (
          <div className="space-y-4">
            <div>
              <p className="meta">Intent</p>
              <h3 className="display text-xl">Name the action</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forge-title">Quest</Label>
              <Input
                id="forge-title"
                value={title}
                autoFocus
                placeholder="Solve 2 algorithm problems"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {activity && SUGGESTIONS[activity] ? (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS[activity].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTitle(s)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      title === s
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="forge-desc">Brief (optional)</Label>
              <Textarea
                id="forge-desc"
                rows={3}
                value={description}
                placeholder="What does done look like?"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {stage === "tune" ? (
          <div className="space-y-5">
            <div>
              <p className="meta">Calibration</p>
              <h3 className="display text-xl">Set the weight</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="forge-duration">Duration</Label>
                <span className="text-sm text-primary">{duration} min</span>
              </div>
              <input
                id="forge-duration"
                type="range"
                min={10}
                max={180}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 min</span>
                <span>3 hours</span>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Difficulty</legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    aria-pressed={difficulty === d}
                    className={cn(
                      "rounded-full transition-transform duration-200",
                      difficulty === d ? "scale-105" : "opacity-55 hover:opacity-100",
                    )}
                  >
                    <DifficultyChip
                      difficulty={d}
                      className={cn("text-xs", difficulty === d && "bg-secondary/60")}
                    />
                  </button>
                ))}
              </div>
              <p className="meta mt-2">
                Rewards are set by the server from difficulty and duration.
              </p>
            </fieldset>
          </div>
        ) : null}

        {stage === "forge" ? (
          <div className="space-y-4 text-center">
            <p className="meta">Ready</p>
            <h3 className="display text-xl">Release it into the world</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              This quest joins today&rsquo;s ledger. Completing it in reality is what moves your
              world.
            </p>
          </div>
        ) : null}
      </SceneReveal>

      {/* -------------------------------------------------- the object itself */}
      <div className="mt-6">
        <p className="meta mb-2">Preview</p>
        <div
          className={cn(
            "panel flex items-center gap-3 p-4 transition-all duration-500",
            stage === "forge" && "glow-gold",
            create.isPending && "scale-[0.99] opacity-70",
          )}
        >
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-lg transition-all duration-500",
              activity ? "opacity-100" : "opacity-40",
            )}
            style={{ color: attrMeta?.tone ?? "var(--muted-foreground)" }}
          >
            <span aria-hidden>{glyph}</span>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-medium transition-opacity duration-500",
                title ? "opacity-100" : "text-muted-foreground opacity-50",
              )}
            >
              {title || "Unnamed quest"}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {/* Each part fades in at the stage that decides it. */}
              <span
                className={cn(
                  "transition-opacity duration-500",
                  stageIndex >= 2 ? "opacity-100" : "opacity-0",
                )}
              >
                <DifficultyChip difficulty={difficulty} />
              </span>
              {attrMeta ? <span>{attrMeta.label}</span> : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 transition-opacity duration-500",
                  stageIndex >= 2 ? "opacity-100" : "opacity-0",
                )}
              >
                <Clock className="size-3" aria-hidden />
                {duration}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          disabled={stageIndex === 0 || create.isPending}
          onClick={() => setStage(STAGES[Math.max(0, stageIndex - 1)]!)}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        {blocker ? (
          <p className="meta ml-auto mr-3 self-center" aria-live="polite">
            {blocker}
          </p>
        ) : null}

        {stage === "forge" ? (
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {create.isPending ? "Forging…" : "Forge quest"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!canAdvance}
            onClick={() => setStage(STAGES[Math.min(STAGES.length - 1, stageIndex + 1)]!)}
          >
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
