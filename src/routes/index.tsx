import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Compass,
  Flame,
  Hammer,
  HeartPulse,
  Milestone,
  RotateCcw,
  Scroll,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SceneReveal } from "@/components/motion";
import { AmbientField } from "@/components/motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Life RPG — Your Real Life Is The Quest" },
      {
        name: "description",
        content:
          "Transform your real habits into living RPG quests. Level up Mind, Focus, Body and Craft in an interactive world built by your daily actions.",
      },
    ],
  }),
  component: LandingPage,
});

const ATTRIBUTES = [
  {
    key: "MIND",
    label: "Mind",
    icon: Brain,
    color: "var(--accent)",
    accentClass:
      "text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]",
    glowClass: "shadow-[0_0_25px_color-mix(in_oklab,var(--accent)_25%,transparent)]",
    blurb: "Coding, deep studies, strategy & intellectual breakthroughs.",
    zone: "The Great Library",
  },
  {
    key: "FOCUS",
    label: "Focus",
    icon: Zap,
    color: "var(--arcane)",
    accentClass:
      "text-[var(--arcane)] border-[color-mix(in_oklab,var(--arcane)_40%,transparent)] bg-[color-mix(in_oklab,var(--arcane)_14%,transparent)]",
    glowClass: "shadow-[0_0_25px_color-mix(in_oklab,var(--arcane)_25%,transparent)]",
    blurb: "Meditation, deep work blocks, calm attention & mental silence.",
    zone: "The Sanctuary of Silence",
  },
  {
    key: "BODY",
    label: "Body",
    icon: HeartPulse,
    color: "var(--success)",
    accentClass:
      "text-[var(--success)] border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
    glowClass: "shadow-[0_0_25px_color-mix(in_oklab,var(--success)_25%,transparent)]",
    blurb: "Steps, physical discipline, restorative sleep & vitality.",
    zone: "The Training Arena",
  },
  {
    key: "CRAFT",
    label: "Craft",
    icon: Hammer,
    color: "var(--ember)",
    accentClass:
      "text-[var(--primary)] border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]",
    glowClass: "shadow-[0_0_25px_color-mix(in_oklab,var(--primary)_25%,transparent)]",
    blurb: "Projects built, rooms cleaned, wealth saved & daily output.",
    zone: "The Artisan Forge",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [checked, setChecked] = useState(false);
  const [activeZone, setActiveZone] = useState<number>(0);
  const [activeDemoState, setActiveDemoState] = useState<"ready" | "completed">("ready");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) void navigate({ to: "/world" });
      else setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (reducedMotion) return;
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reducedMotion]);

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground overflow-x-hidden">
      {/*
        The environment. Shared with the gate and onboarding, so moving between
        them reads as travelling through one space rather than loading pages.
      */}
      <AmbientField intensity={1} />

      {/* Hero Section */}
      <section className="relative z-10 mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-between px-5 pt-8 pb-16 sm:px-8">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border/30 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-primary/40 bg-primary/10">
              <Compass className="h-4 w-4 text-primary" />
            </div>
            <span className="display text-sm font-bold tracking-widest text-foreground uppercase">
              Life RPG
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Begin
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </header>

        {/* Hero Central Composition */}
        <div className="my-auto py-12 lg:py-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-secondary/40 px-3.5 py-1 text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-6 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            <span>Field Chronicle · Est. 2026</span>
          </div>

          <h1 className="display text-[clamp(2.5rem,8vw,5.5rem)] font-black tracking-tight leading-[0.95] uppercase text-foreground drop-shadow-sm">
            Your Real Life
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] via-primary to-[var(--accent)]">
              Is The Quest
            </span>
          </h1>

          <p className="mt-8 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-sans">
            Sleep, workouts, code sprints, and mindful focus — not logged into cold spreadsheets,
            but forged into character levels, unlocked territories, and personal history.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="glow-gold">
              <Link to="/auth" search={{ mode: "signup" }}>
                Begin your journey
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>

            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "login" }}>
                Resume character
              </Link>
            </Button>
          </div>

          {/* Core Philosophy Badge */}
          <div className="mt-12 pt-8 border-t border-border/20 flex flex-wrap items-center justify-center gap-6 text-xs font-mono uppercase text-muted-foreground tracking-widest">
            <span>⚔ Real Life Action</span>
            <span className="text-border">→</span>
            <span>📜 Living Quests</span>
            <span className="text-border">→</span>
            <span>⚡ XP & Progression</span>
            <span className="text-border">→</span>
            <span>🗺 Expanding World</span>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="flex justify-center pt-4">
          <a
            href="#story-world"
            className="flex flex-col items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <span>Scroll To Explore</span>
            <div className="w-4 h-7 rounded-full border border-border/50 flex items-start justify-center p-1">
              <div className="w-1 h-1.5 rounded-full bg-primary animate-bounce" />
            </div>
          </a>
        </div>
      </section>

      {/* Act I: The Living World */}
      <section
        id="story-world"
        className="relative z-10 border-t border-border/40 py-24 px-5 sm:px-8"
      >
        <SceneReveal className="mx-auto max-w-6xl" from="below" duration={820}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
                Act I · The Living World
              </p>
              <h2 className="display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-foreground">
                A Map That Evolves With You
              </h2>
            </div>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              Your dashboard isn't a grid of charts. It's a living isometric world with five
              territories that physically rise and expand each time you complete a task in reality.
            </p>
          </div>

          {/* Interactive World Zone Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Zone Selector on left */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3">
              {ATTRIBUTES.map((attr, idx) => {
                const Icon = attr.icon;
                const isCurrent = activeZone === idx;
                return (
                  <button
                    key={attr.key}
                    type="button"
                    onClick={() => setActiveZone(idx)}
                    className={cn(
                      "group flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-300",
                      isCurrent
                        ? cn("border-border bg-card/80 shadow-lg", attr.glowClass)
                        : "border-border/30 bg-card/20 hover:border-border/60 hover:bg-card/40",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all",
                        isCurrent
                          ? attr.accentClass
                          : "border-border/40 bg-secondary/30 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="display text-base font-bold uppercase tracking-wide text-foreground">
                          {attr.label}
                        </span>
                        <span className="text-[11px] font-mono uppercase text-muted-foreground">
                          · {attr.zone}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {attr.blurb}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Simulated Live World Visualizer on right */}
            <div className="lg:col-span-7 rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-background/90 p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/30 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
                  <span className="display text-xs font-bold uppercase tracking-wider text-foreground">
                    World Zone: {(ATTRIBUTES[activeZone] ?? ATTRIBUTES[0]!).zone}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-primary font-bold uppercase">
                  Tier 3 Activated
                </span>
              </div>

              {/* Geometric Interactive Territory Representation */}
              {(() => {
                const currentAttr = ATTRIBUTES[activeZone] ?? ATTRIBUTES[0]!;
                const CurrentIcon = currentAttr.icon;
                return (
                  <div className="my-8 flex items-center justify-center relative min-h-[260px]">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <div className="w-64 h-64 border border-dashed border-primary rounded-full animate-spin [animation-duration:40s]" />
                      <div className="absolute w-48 h-48 border border-border rounded-full" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl max-w-sm">
                      <div
                        className={cn(
                          "w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 transition-all duration-500",
                          currentAttr.accentClass,
                          currentAttr.glowClass,
                        )}
                      >
                        <CurrentIcon className="w-8 h-8" />
                      </div>
                      <h3 className="display text-xl font-bold uppercase text-foreground">
                        {currentAttr.zone}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2">
                        Gains XP directly when real-life {currentAttr.label} quests are conquered.
                      </p>
                      <div className="mt-4 flex items-center gap-3 text-xs font-mono">
                        <span className="text-primary font-bold">+60 XP / Session</span>
                        <span className="text-border">·</span>
                        <span className="text-muted-foreground">Chain Booster x1.2</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-border/30 pt-4 flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>SECTOR: 0{activeZone + 1}</span>
                <span>HARMONY INDEX: 94%</span>
              </div>
            </div>
          </div>
        </SceneReveal>
      </section>

      {/* Act II: Quests as Living Objects */}
      <section className="relative z-10 border-t border-border/40 py-24 px-5 sm:px-8 bg-card/10">
        <SceneReveal className="mx-auto max-w-6xl" from="below" duration={820}>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
              Act II · The Living Quests
            </p>
            <h2 className="display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-foreground">
              Not Boring Checklists. Physical Objects.
            </h2>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              Every quest in LifeRPG carries gravity. It displays its attribute resonance, XP value,
              gold bounty, duration, and recommendation rationale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Quest 1 - Active Demo */}
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-card/60 p-5 shadow-[0_0_25px_color-mix(in_oklab,var(--accent)_15%,transparent)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--accent)]">
                  <span className="uppercase tracking-widest">MIND · CODING</span>
                  <span>45 MIN</span>
                </div>
                <h3 className="display text-lg font-bold text-foreground mt-3">
                  Solve 2 Graph Traversal Problems
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Deep focus sprint on BFS/DFS techniques. Feeds The Great Library.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-primary font-bold">+70 XP</span>
                  <span className="text-[var(--primary)] font-bold">+25 Gold</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Optimal</span>
                </div>
              </div>
            </div>

            {/* Quest 2 - Focus */}
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--arcane)_40%,transparent)] bg-card/60 p-5 shadow-[0_0_25px_color-mix(in_oklab,var(--arcane)_15%,transparent)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--arcane)]">
                  <span className="uppercase tracking-widest">FOCUS · MEDITATION</span>
                  <span>15 MIN</span>
                </div>
                <h3 className="display text-lg font-bold text-foreground mt-3">
                  Morning Breath Sanctuary
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Quiet breath awareness before opening screens or checking messages.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-primary font-bold">+40 XP</span>
                  <span className="text-[var(--primary)] font-bold">+15 Gold</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--arcane)] font-mono">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Streak Keeper</span>
                </div>
              </div>
            </div>

            {/* Quest 3 - Body */}
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-card/60 p-5 shadow-[0_0_25px_color-mix(in_oklab,var(--success)_15%,transparent)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--success)]">
                  <span className="uppercase tracking-widest">BODY · WALKING</span>
                  <span>8,000 STEPS</span>
                </div>
                <h3 className="display text-lg font-bold text-foreground mt-3">
                  Outdoor Distance Patrol
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Aerobic movement outdoors. Elevates cellular energy and restores focus.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-primary font-bold">+60 XP</span>
                  <span className="text-[var(--primary)] font-bold">+20 Gold</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--success)] font-mono">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Chain Active</span>
                </div>
              </div>
            </div>
          </div>
        </SceneReveal>
      </section>

      {/* Act III: Adaptive Rescope Mechanic */}
      <section className="relative z-10 border-t border-border/40 py-24 px-5 sm:px-8">
        <SceneReveal className="mx-auto max-w-6xl" from="below" duration={820}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[var(--primary)] mb-4">
                <RotateCcw className="w-3 h-3" />
                <span>The Core Product Law</span>
              </div>
              <h2 className="display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-foreground leading-[1.05]">
                "Adapt the task,
                <br />
                not the trophy."
              </h2>
              <p className="mt-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
                When a quest becomes too large or real life interrupts, traditional apps guilt-trip
                you or break your streaks. Life RPG introduces <strong>Rescope</strong>: an
                intelligent safety valve that dynamically assists you in adapting the scope.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3.5">
                  <p className="text-primary font-bold uppercase">SPLIT</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Branches large mountain into 2–3 bite-sized child quests.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3.5">
                  <p className="text-primary font-bold uppercase">SHRINK</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Reduces duration/steps while maintaining habit momentum.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3.5">
                  <p className="text-primary font-bold uppercase">RESCHEDULE</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Moves the deadline forward without shame or penalty.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3.5">
                  <p className="text-primary font-bold uppercase">EXTEND</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Grants breathing room to complete quality work.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Branching Tree Demonstration */}
            <div className="lg:col-span-6 rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-xl shadow-2xl">
              <div className="text-xs font-mono uppercase text-muted-foreground flex items-center justify-between border-b border-border/30 pb-3">
                <span>Branching Hierarchy Demo</span>
                <span className="text-[var(--primary)]">At-Risk Quest Rescoped</span>
              </div>

              {/* Parent Quest */}
              <div className="mt-6 rounded-xl border border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] p-4 text-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--primary)]">
                  Parent Quest · [Build Portfolio Site]
                </span>
                <p className="display text-base font-bold text-foreground mt-1">
                  120 Minutes Target
                </p>
              </div>

              {/* Tree Connection Lines */}
              <div className="flex flex-col items-center my-3">
                <div className="w-px h-6 bg-border" />
                <div className="w-3/4 h-px bg-border" />
              </div>

              {/* Children Quests */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Part 01</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">Wireframe</p>
                  <span className="text-[10px] font-mono text-primary mt-1 block">30m · 25 XP</span>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Part 02</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">Copywriting</p>
                  <span className="text-[10px] font-mono text-primary mt-1 block">45m · 30 XP</span>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Part 03</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">Deploy</p>
                  <span className="text-[10px] font-mono text-primary mt-1 block">45m · 35 XP</span>
                </div>
              </div>

              <p className="text-[11px] font-mono text-center text-muted-foreground mt-4">
                Total XP reconciles with 100% precision. Never break your stride.
              </p>
            </div>
          </div>
        </SceneReveal>
      </section>

      {/* Act IV: Chronicle & Treasury */}
      <section className="relative z-10 border-t border-border/40 py-24 px-5 sm:px-8 bg-card/20">
        <SceneReveal className="mx-auto max-w-6xl" from="below" duration={820}>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
              Act IV · Chronicle & Treasury
            </p>
            <h2 className="display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-foreground">
              Evidence of a Life Well Lived
            </h2>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              Every completed day is pressed onto your 12-week heatmap. Coins earned in honest
              effort unlock progression artifacts in the Treasury — with zero pay-to-win mechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Milestone className="w-6 h-6" />
              </div>
              <h3 className="display text-xl font-bold uppercase text-foreground">
                12-Week Ledger
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                A continuous heatmap recording every day you showed up. Tap any past day to review
                its exact quest entries and wax seals.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] flex items-center justify-center text-[var(--primary)] mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="display text-xl font-bold uppercase text-foreground">
                Authentic Treasury
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Spend gold on XP Boosters, Streak Shields, and Custom Seals. Every reward is bought
                with sweat, never credit cards.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] flex items-center justify-center text-[var(--accent)] mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="display text-xl font-bold uppercase text-foreground">
                Postgres Authoritative
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                No fragile local state. Row-level security, server-authoritative calculations, and
                rock-solid persistence across hard refreshes and devices.
              </p>
            </div>
          </div>
        </SceneReveal>
      </section>

      {/* Cinematic Final Call to Action */}
      <section className="relative z-10 border-t border-border/40 py-24 px-5 sm:px-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-mono uppercase tracking-widest text-primary mb-6">
            <Compass className="w-3.5 h-3.5" />
            <span>Character Creation Ready</span>
          </div>

          <h2 className="display text-4xl sm:text-6xl font-black uppercase tracking-tight text-foreground">
            The World Awaits
            <br />
            Your First Step
          </h2>

          <p className="mt-6 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Create your character now. Configure your real-life routines, forge your starter quests,
            and watch your personal world come alive.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="glow-gold">
              <Link to="/auth" search={{ mode: "signup" }}>
                Begin your journey
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <footer className="mt-20 pt-8 border-t border-border/20 text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
            Life RPG · No Loot Boxes · No Pay-To-Win · Est. 2026
          </footer>
        </div>
      </section>
    </div>
  );
}
