import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Check,
  Coins,
  Compass,
  FlaskConical,
  Loader2,
  Lock,
  Package,
  Scroll,
  ShieldCheck,
} from "lucide-react";

import { getRewards, purchaseItem } from "@/lib/player.functions";
import { formatNumber } from "@/lib/game";
import { RARITY_TONE } from "@/engine/gameRules";
import { ErrorNote, LoadingSheet } from "@/components/chronicle/States";
import { useOnlineStatus } from "@/components/chronicle/OfflineBanner";
import { Button } from "@/components/ui/button";
import { CountUp, SceneReveal } from "@/components/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Treasury & Rewards — Life RPG" },
      {
        name: "description",
        content:
          "Spend the coins you earned through honest effort. No chests, no randomness, no real money.",
      },
    ],
  }),
  component: RewardsPage,
});

const ITEM_AFFINITY: Record<string, string[]> = {
  xp_potion: ["progress", "mastery"],
  streak_shield: ["protection", "quiet"],
  quill_seal: ["cosmetic", "variety"],
  cartographer: ["world", "cosmetic"],
};

const ITEM_ICONS: Record<string, typeof FlaskConical> = {
  xp_potion: FlaskConical,
  streak_shield: ShieldCheck,
  quill_seal: Scroll,
  cartographer: Compass,
};

/**
 * The treasury, in Hello Helper's surface language: neutral `panel` cards with
 * rarity carried on the chip text, and the ZIP's `bg-secondary/60` tile for the
 * relic itself.
 *
 * Two motions carry the transaction. The relic lifts on hover, so it reads as
 * an object to be picked up; and on purchase the price flies up out of the card
 * while the vault balance counts down to its new value — the coins are seen
 * leaving the item and arriving in the balance, rather than both numbers simply
 * being different on the next render.
 */
function RewardsPage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [purchasingCode, setPurchasingCode] = useState<string | null>(null);
  const [justAcquired, setJustAcquired] = useState<string | null>(null);
  const rewards = useQuery({ queryKey: ["rewards"], queryFn: () => getRewards() });

  const buy = useMutation({
    mutationFn: (itemCode: string) => {
      if (!online) throw new Error("OFFLINE");
      setPurchasingCode(itemCode);
      return purchaseItem({ data: { itemCode } });
    },
    onSuccess: async (_result, itemCode) => {
      setError(null);
      // Hold the confirmation long enough to be read, then release it.
      setJustAcquired(itemCode);
      window.setTimeout(() => setJustAcquired(null), 2200);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rewards"] }),
        queryClient.invalidateQueries({ queryKey: ["player"] }),
      ]);
    },
    onError: (err) =>
      setError(
        err instanceof Error && err.message === "OFFLINE"
          ? "You're offline — nothing was purchased."
          : err instanceof Error && err.message.includes("gold")
            ? "Insufficient treasury coins. Conquer more quests in reality first."
            : "Couldn't complete that purchase.",
      ),
    onSettled: () => setPurchasingCode(null),
  });

  const items = useMemo(() => {
    const prefs = rewards.data?.rewardPrefs ?? [];
    return [...(rewards.data?.items ?? [])].sort((a, b) => {
      const aScore = (ITEM_AFFINITY[a.code] ?? []).filter((p) => prefs.includes(p)).length;
      const bScore = (ITEM_AFFINITY[b.code] ?? []).filter((p) => prefs.includes(p)).length;
      if (aScore !== bScore) return bScore - aScore;
      return a.sort_order - b.sort_order;
    });
  }, [rewards.data]);

  if (rewards.isLoading) return <LoadingSheet rows={2} />;
  if (rewards.isError || !rewards.data)
    return (
      <ErrorNote message="Couldn't open the treasury strongbox" onRetry={() => rewards.refetch()} />
    );

  const owned = new Map(rewards.data.inventory.map((row) => [row.item_code, row.quantity]));

  return (
    <div className="space-y-8">
      <SceneReveal as="header" from="below" duration={760}>
        <section className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="glow-gold flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary/60 text-primary">
              <Coins className="size-7" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <p className="meta">Sovereign treasury</p>
              <h1 className="display truncate text-2xl">Rewards vault</h1>
              <p className="text-sm text-muted-foreground">
                Spend coins earned through physical reality. No microtransactions, no pay-to-win.
              </p>
            </div>

            <dl className="text-center">
              <dt className="meta">Balance</dt>
              <dd className="display text-2xl text-primary">
                <CountUp value={rewards.data.gold} format={formatNumber} />
              </dd>
            </dl>
          </div>
        </section>
      </SceneReveal>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} inline />}

      <section aria-labelledby="catalog-heading" className="space-y-4">
        <SceneReveal>
          <div className="flex items-end justify-between gap-4">
            <h2 id="catalog-heading" className="display text-xl">
              Artifacts &amp; relics
            </h2>
            <span className="meta hidden sm:inline">Permanent &amp; single-use charms</span>
          </div>
        </SceneReveal>

        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item, index) => {
            const quantity = owned.get(item.code) ?? 0;
            const affordable = rewards.data.gold >= item.price_gold;
            const isBuying = purchasingCode === item.code;
            const acquired = justAcquired === item.code;
            const Icon = ITEM_ICONS[item.code] ?? Package;
            const tone = RARITY_TONE[item.rarity] ?? "var(--primary)";

            return (
              <SceneReveal
                key={item.code}
                as="li"
                from={index % 2 === 0 ? "left" : "right"}
                delay={index * 80}
              >
                <article
                  className={cn(
                    "panel group relative flex h-full flex-col justify-between p-5 transition-transform duration-300 hover:-translate-y-1",
                    acquired && "animate-pop-in",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/60"
                      style={{ color: tone }}
                    >
                      <Icon className="size-6" aria-hidden />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="rounded-full border px-2 py-0.5 tracking-wide uppercase"
                          style={{
                            color: tone,
                            borderColor: `color-mix(in oklab, ${tone} 40%, transparent)`,
                          }}
                        >
                          {item.rarity}
                        </span>
                        {quantity > 0 ? (
                          <span className="inline-flex items-center gap-1 text-chart-5">
                            <Check className="size-3" aria-hidden /> Owned {quantity}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-sm text-primary">💰 {formatNumber(item.price_gold)}</span>

                    <Button
                      size="sm"
                      variant={affordable ? "default" : "outline"}
                      disabled={!affordable || buy.isPending}
                      onClick={() => buy.mutate(item.code)}
                    >
                      {isBuying ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : affordable ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <Lock className="size-4" aria-hidden />
                      )}
                      {isBuying
                        ? "Acquiring…"
                        : affordable
                          ? "Acquire"
                          : `Need ${formatNumber(item.price_gold - rewards.data.gold)}`}
                    </Button>
                  </div>

                  {/* The price leaving the relic, toward the vault balance above */}
                  {acquired ? (
                    <span
                      aria-hidden
                      className="animate-coin-fly pointer-events-none absolute top-2 right-8 text-sm font-semibold text-primary"
                    >
                      −{formatNumber(item.price_gold)}
                    </span>
                  ) : null}
                </article>
              </SceneReveal>
            );
          })}
        </ul>
      </section>

      <p aria-live="polite" className="sr-only">
        {justAcquired ? "Relic acquired." : ""}
      </p>
    </div>
  );
}
