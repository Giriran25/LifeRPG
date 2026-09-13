import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Compass,
  Hammer,
  HeartPulse,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
  XCircle,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { browserTimezone } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { AmbientField, SceneReveal } from "@/components/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["login", "signup"]).optional() }),
  head: () => ({
    meta: [
      { title: "Character Gate — Life RPG" },
      {
        name: "description",
        content:
          "Create your Life RPG character or sign back in to continue your streak and world expansion.",
      },
    ],
  }),
  component: AuthPage,
});

const GENERIC_FAILURE = "Those credentials don't match a recorded character.";
const USERNAME_RE = /^[a-z0-9_]{3,24}$/i;

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "signup");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "free" | "taken" | "invalid"
  >("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (session) void navigate({ to: "/world" });
  }, [session, navigate]);

  // Debounced username availability check against database RPC
  useEffect(() => {
    if (mode !== "signup") return;
    const value = username.trim();
    if (!value) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("username_available", {
        p_username: value,
      });
      if (rpcError) setAvailability("idle");
      else setAvailability(data ? "free" : "taken");
    }, 400);
    return () => clearTimeout(timer.current);
  }, [username, mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        if (!USERNAME_RE.test(username.trim())) {
          setError("Usernames must be 3–24 letters, numbers or underscores.");
          return;
        }
        if (password.length < 8) {
          setError("Passwords must contain at least 8 characters.");
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: fullName.trim() || username.trim(),
              full_name: fullName.trim(),
              username: username.trim(),
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (!data.session) {
          setNotice("Verification link sent. Check your inbox, then sign in to begin.");
          setMode("login");
          return;
        }
        await supabase
          .from("profiles")
          .update({ timezone: browserTimezone() })
          .eq("id", data.session.user.id);
        void navigate({ to: "/onboarding" });
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError || !data.user) {
          setError(GENERIC_FAILURE);
          return;
        }
        await supabase
          .from("profiles")
          .update({ timezone: browserTimezone() })
          .eq("id", data.user.id);
        void navigate({ to: "/world" });
      }
    } catch {
      setError(GENERIC_FAILURE);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in didn't complete. Try email instead.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/world" });
  }

  const availabilityHint = {
    idle: "3–24 letters, numbers or underscores",
    checking: "Checking ledger availability…",
    free: "Identity available for claiming",
    taken: "Already claimed by another character",
    invalid: "Only letters, numbers, and underscores allowed",
  }[availability];

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      {/*
        The same ambient field the landing page stands in, so arriving at the
        gate reads as walking further into one space rather than loading a
        separate screen.
      */}
      <AmbientField intensity={0.8} />

      {/* LEFT COLUMN: Editorial World & Character Scene (Desktop) */}
      <div className="relative hidden lg:flex lg:w-7/12 flex-col justify-between border-r border-border/40 bg-card/20 p-12 overflow-hidden">
        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/50 bg-primary/10">
              <Compass className="h-4 w-4 text-primary" />
            </div>
            <span className="display text-sm font-bold tracking-widest text-foreground uppercase">
              Life RPG
            </span>
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-secondary/30 px-3 py-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Gate of Genesis</span>
          </div>
        </div>

        {/* Center Character Lore & Real-time Live Sigil Preview */}
        <SceneReveal className="relative z-10 my-auto max-w-lg" from="left" duration={860}>
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
            {mode === "signup" ? "Character Forging Protocol" : "Chronicle Re-entry"}
          </p>

          <h2 className="display text-4xl xl:text-5xl font-extrabold uppercase tracking-tight text-foreground leading-[1.05]">
            "Your Life is the Engine.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] via-primary to-[var(--accent)]">
              The World is the Mirror."
            </span>
          </h2>

          <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
            Every quest you create directly translates real-world habits into XP, attribute power,
            and unlocked territories. No lootboxes. No artificial paywalls.
          </p>

          {/* Identity manifest — fills in live as the form is typed into */}
          <SceneReveal
            className="mt-10 rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-xl shadow-2xl"
            from="below"
            delay={260}
          >
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-muted-foreground border-b border-border/40 pb-3">
              <span>Identity Manifest</span>
              <span className="text-primary">Status: Initializing</span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/50 bg-primary/10 text-primary shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <p className="display text-lg font-bold uppercase text-foreground">
                  {fullName.trim() ||
                    (mode === "signup" ? "Unforged Adventurer" : "Returning Hero")}
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  @{username.trim() || (mode === "signup" ? "choose_handle" : "character")}
                </p>
              </div>
            </div>

            {/* 4 Attribute Gauges */}
            <div className="mt-6 grid grid-cols-4 gap-2 text-center text-[10px] font-mono uppercase">
              <div className="rounded-lg border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] py-2 text-[var(--accent)]">
                <Brain className="w-3.5 h-3.5 mx-auto mb-1" />
                <span>Mind</span>
              </div>
              <div className="rounded-lg border border-[color-mix(in_oklab,var(--arcane)_30%,transparent)] bg-[color-mix(in_oklab,var(--arcane)_14%,transparent)] py-2 text-[var(--arcane)]">
                <Zap className="w-3.5 h-3.5 mx-auto mb-1" />
                <span>Focus</span>
              </div>
              <div className="rounded-lg border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)] py-2 text-[var(--success)]">
                <HeartPulse className="w-3.5 h-3.5 mx-auto mb-1" />
                <span>Body</span>
              </div>
              <div className="rounded-lg border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] py-2 text-[var(--primary)]">
                <Hammer className="w-3.5 h-3.5 mx-auto mb-1" />
                <span>Craft</span>
              </div>
            </div>
          </SceneReveal>
        </SceneReveal>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-muted-foreground/60 uppercase">
          <span>Row-Level Security Active</span>
          <span>PostgreSQL Authoritative</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Auth Interaction Scene */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
        {/* Mobile Header */}
        <div className="flex lg:hidden items-center justify-between pb-6 border-b border-border/30">
          <Link to="/" className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <span className="display text-sm font-bold uppercase text-foreground">Life RPG</span>
          </Link>
          <span className="text-xs font-mono text-muted-foreground uppercase">Genesis</span>
        </div>

        <div className="my-auto py-8">
          {/* Mode Switcher */}
          <SceneReveal
            as="div"
            from="below"
            className="flex rounded-xl border border-border/60 bg-secondary/30 p-1 mb-8"
          >
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-wider transition-all",
                mode === "signup"
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              New Character
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-wider transition-all",
                mode === "login"
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sign In
            </button>
          </SceneReveal>

          {/*
            Keyed on mode: switching between forging and resuming replays the
            entrance, so the panel reads as a different room in the same gate
            rather than the same panel swapping its labels.
          */}
          <SceneReveal key={mode} className="mb-6" from="right" duration={560}>
            <h1 className="display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-foreground">
              {mode === "signup" ? "Forge Your Character" : "Resume Chronicle"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              {mode === "signup"
                ? "Enter identity details to establish your character record."
                : "Enter credentials to resume your living world and active streaks."}
            </p>
          </SceneReveal>

          {/* Form */}
          <form className="space-y-4" onSubmit={submit} noValidate>
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="fullName"
                    className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5"
                  >
                    Full Name / Alias
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ranjith Kumar"
                      autoComplete="name"
                      required
                      className="w-full rounded-xl border border-border/80 bg-secondary/20 pl-10 pr-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-secondary/40 focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="username"
                      className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                    >
                      Username / Handle
                    </label>
                    {availability === "checking" && (
                      <span className="text-[11px] font-mono text-muted-foreground">Checking…</span>
                    )}
                    {availability === "free" && (
                      <span className="text-[11px] font-mono text-[var(--success)] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Available
                      </span>
                    )}
                    {availability === "taken" && (
                      <span className="text-[11px] font-mono text-destructive flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Claimed
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">
                      @
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="adventurer_name"
                      autoComplete="username"
                      required
                      className={cn(
                        "w-full rounded-xl border bg-secondary/20 pl-9 pr-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-1",
                        availability === "taken" || availability === "invalid"
                          ? "border-destructive/80 focus:border-destructive focus:ring-destructive"
                          : availability === "free"
                            ? "border-[color-mix(in_oklab,var(--success)_80%,transparent)] focus:border-[var(--success)] focus:ring-[var(--success)]"
                            : "border-border/80 focus:border-primary focus:ring-primary",
                      )}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground/80 mt-1">
                    {availabilityHint}
                  </p>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hero@kingdom.org"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-border/80 bg-secondary/20 pl-10 pr-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-secondary/40 focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  className="w-full rounded-xl border border-border/80 bg-secondary/20 pl-10 pr-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-secondary/40 focus:ring-1 focus:ring-primary"
                />
              </div>
              {mode === "signup" && (
                <p className="text-[11px] font-mono text-muted-foreground/80 mt-1">
                  At least 8 characters required
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="rounded-xl border border-[color-mix(in_oklab,var(--success)_50%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)] p-3 text-xs text-[var(--success)] flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Transcribing…" : mode === "signup" ? "Forge character" : "Enter world"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border/40" />
            <span className="text-[11px] font-mono uppercase text-muted-foreground">
              or continue with
            </span>
            <span className="h-px flex-1 bg-border/40" />
          </div>

          {/* Google OAuth */}
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Google account
          </Button>
        </div>

        {/* Bottom Toggle Note */}
        <div className="pt-6 border-t border-border/20 text-center text-xs text-muted-foreground">
          {mode === "signup"
            ? "Already have a character record?"
            : "Need to establish your character?"}{" "}
          <button
            type="button"
            className="text-primary font-semibold underline underline-offset-4 hover:text-primary/80 transition-colors"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Sign in to chronicle" : "Create new character"}
          </button>
        </div>
      </div>
    </div>
  );
}
