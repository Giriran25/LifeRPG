import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";

export type Badge = { code: string; name: string; emoji: string; description: string };

export type CelebrationEvent =
  | { kind: "level"; fromLevel: number; toLevel: number; unlocks?: string }
  | { kind: "badge"; badges: Badge[] }
  | { kind: "entry"; text: string };

type Ctx = { celebrate: (event: CelebrationEvent) => void };

const CelebrationContext = createContext<Ctx>({ celebrate: () => {} });

export function useCelebration() {
  return useContext(CelebrationContext);
}

/**
 * The payoff moment, in Hello Helper's celebration language.
 *
 * Structure is the ZIP's: a `panel animate-pop-in` dialog over a
 * `bg-background/85 backdrop-blur-md` scrim, `animate-rise` glyphs drifting up
 * behind it, the eyebrow set in `display tracking-[0.35em] uppercase`, and one
 * full-width <Button> to continue. Level-ups show the old number handing over
 * to the new one, which is the single piece of choreography here: the
 * transformation is shown, not just its result.
 *
 * Driven entirely by what complete_quest returned — this component computes no
 * rewards of its own.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);
  const celebrate = useCallback((event: CelebrationEvent) => {
    setQueue((current) => [...current, event]);
  }, []);
  const value = useMemo(() => ({ celebrate }), [celebrate]);
  const current = queue[0];
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  // The inline entry note retires itself; the modal waits for the player.
  useEffect(() => {
    if (current?.kind !== "entry") return;
    const timer = setTimeout(dismiss, 3200);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}

      <div aria-live="polite" className="sr-only">
        {current?.kind === "level"
          ? `Territory expanded. You reached level ${current.toLevel}.`
          : current?.kind === "badge"
            ? `Unlocked ${current.badges.map((b) => b.name).join(", ")}.`
            : current?.kind === "entry"
              ? current.text
              : ""}
      </div>

      {/* The quiet one: a note that something was recorded. */}
      {current?.kind === "entry" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
          <p className="panel animate-pop-in px-4 py-2 text-sm">{current.text}</p>
        </div>
      ) : null}

      {current && current.kind !== "entry" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.kind === "level" ? "Level up" : "Badge unlocked"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-md"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="animate-rise absolute bottom-0 text-2xl text-primary/70"
                style={{ left: `${(i * 7 + 4) % 100}%`, animationDelay: `${(i % 7) * 0.28}s` }}
              >
                {["◈", "◆", "✦", "◇"][i % 4]}
              </span>
            ))}
          </div>

          <div className="panel animate-pop-in relative w-full max-w-md p-6 text-center">
            {current.kind === "level" ? (
              <>
                <p className="display text-sm tracking-[0.35em] text-primary uppercase">Level up</p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <span className="display text-4xl text-muted-foreground">
                    {current.fromLevel}
                  </span>
                  <span className="text-2xl text-primary" aria-hidden>
                    →
                  </span>
                  <span className="display glow-gold rounded-xl px-4 py-2 text-5xl text-primary">
                    {current.toLevel}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold">Territory expanded</h2>
                {current.unlocks ? (
                  <p className="mt-2 text-sm text-muted-foreground">{current.unlocks}</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="display text-sm tracking-[0.35em] text-primary uppercase">
                  Badge unlocked
                </p>
                <h2 className="mt-4 text-2xl font-semibold">
                  {current.badges.length === 1
                    ? current.badges[0]!.name
                    : `${current.badges.length} new seals`}
                </h2>

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {current.badges.map((b) => (
                    <div key={b.code} className="panel w-32 p-3">
                      <div className="text-3xl text-primary" aria-hidden>
                        {b.emoji || "◈"}
                      </div>
                      <p className="mt-1 text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button className="mt-6 w-full" onClick={dismiss} autoFocus>
              Continue the journey
            </Button>
          </div>
        </div>
      ) : null}
    </CelebrationContext.Provider>
  );
}
