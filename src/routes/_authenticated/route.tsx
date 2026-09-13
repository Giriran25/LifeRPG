import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Coins, Compass, Flame, LogOut, Scroll } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CelebrationProvider } from "@/components/chronicle/Celebration";
import { OfflineBanner } from "@/components/chronicle/OfflineBanner";
import { ErrorNote } from "@/components/chronicle/States";
import { Button } from "@/components/ui/button";
import { AmbientField, SceneTransition } from "@/components/motion";
import { getPlayerState } from "@/lib/player.functions";

/**
 * Onboarding is checked once per session, not on every navigation.
 */
let onboardingVerifiedFor: string | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // A character without a world has nowhere to stand: finish onboarding first.
    if (onboardingVerifiedFor !== data.user.id) {
      try {
        const state = await getPlayerState();
        if (state.profile && !state.profile.onboarding_complete) {
          throw redirect({ to: "/onboarding" });
        }
        onboardingVerifiedFor = data.user.id;
      } catch (err) {
        if (err && typeof err === "object" && "to" in err) throw err;
      }
    }

    return { user: data.user };
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
});

function AuthedError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="display text-2xl">This entry didn&rsquo;t load</h1>
      <div className="mt-6">
        <ErrorNote message="Something went wrong on our side" onRetry={reset} />
      </div>
    </main>
  );
}

const NAV = [
  { to: "/world", label: "World", icon: Compass },
  { to: "/quests", label: "Quests", icon: Scroll },
  { to: "/chronicle", label: "Chronicle", icon: Flame },
  { to: "/rewards", label: "Treasury", icon: Coins },
] as const;

/**
 * The shell the whole world is seen through.
 *
 * The ambient field and the chrome sit *outside* the scene frame, so navigating
 * changes only the content while the environment persists — which is what makes
 * moving between World, Quests and Chronicle read as travelling through one
 * place rather than loading separate documents.
 */
function AuthedLayout() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") void router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <CelebrationProvider>
      <AmbientField intensity={0.62} />

      <div className="relative z-10 min-h-screen pb-24 text-foreground lg:pb-12">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
            <Link to="/world" className="group flex items-center gap-2.5">
              <span className="glow-gold flex size-8 items-center justify-center rounded-lg bg-secondary/60 text-primary transition-transform group-hover:scale-105">
                <Compass className="size-4" aria-hidden />
              </span>
              <span className="display text-base">Life RPG</span>
            </Link>

            <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs tracking-wide text-muted-foreground uppercase transition-colors hover:bg-secondary/50 hover:text-foreground"
                    activeProps={{ className: "!bg-secondary/70 !text-primary" }}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Depart</span>
            </Button>
          </div>
        </header>

        <OfflineBanner />

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <SceneTransition>
            <Outlet />
          </SceneTransition>
        </main>

        <footer className="mx-auto hidden max-w-5xl px-4 py-8 text-center sm:px-6 lg:block">
          <p className="meta">Life RPG · real-world progression</p>
        </footer>

        {/* Mobile dock */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-2 backdrop-blur-xl lg:hidden"
        >
          <ul className="flex items-center justify-around gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="flex-1">
                  <Link
                    to={item.to}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-muted-foreground transition-transform active:scale-95"
                    activeProps={{ className: "!bg-secondary/70 !text-primary" }}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="meta">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </CelebrationProvider>
  );
}
