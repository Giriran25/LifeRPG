import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

/**
 * Loading, empty and error states in Hello Helper's language.
 *
 * Skeletons mirror the real layout — a `panel` row with a glyph tile and two
 * text lines — so a list does not jump when the data lands. Errors stay in
 * voice and always offer a way out. Every surface is `panel`; every action is
 * the shared <Button>.
 */

export function LoadingSheet({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="size-16 shrink-0 animate-pulse rounded-2xl bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-48 max-w-full animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
        <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-muted/50" />
      </div>

      <ul className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="panel flex items-center gap-3 p-4">
            <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/50" />
            </div>
            <div className="h-8 w-24 shrink-0 animate-pulse rounded-md bg-muted/50" />
          </li>
        ))}
      </ul>

      <p className="meta text-center">Preparing your next entries…</p>
    </div>
  );
}

export function EmptyState({
  title = "Your world is waiting",
  caption = "Nothing is logged for today. Write the first entry.",
  actionLabel = "Create quest",
  to = "/quests",
}: {
  title?: string;
  caption?: string;
  actionLabel?: string;
  to?: string;
}) {
  return (
    <section className="panel p-8 text-center">
      <div
        className="glow-gold mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary/60 text-2xl text-primary"
        aria-hidden
      >
        ◈
      </div>
      <h2 className="display text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{caption}</p>
      <Button asChild className="mt-5">
        <Link to={to}>{actionLabel}</Link>
      </Button>
    </section>
  );
}

export function ErrorNote({
  message,
  onRetry,
  inline = false,
}: {
  message: string;
  onRetry: () => void;
  inline?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm text-destructive">{message}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </>
  );

  if (inline)
    return (
      <div role="alert" className="border-l-2 border-destructive pl-4">
        {body}
      </div>
    );

  return (
    <section role="alert" className="panel p-5 sm:p-6">
      {body}
    </section>
  );
}
