import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The signature device: an 11px uppercase mono label in ink-faint. Used for
 * every small label in the app — quest IDs, durations, dates, units, section
 * tags — so display type never has to shrink to carry metadata.
 */
export function MetaLabel({
  children,
  className,
  as: Tag = "p",
  tone,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  tone?: string;
}) {
  return (
    <Tag className={cn("meta", className)} style={tone ? { color: tone } : undefined}>
      {children}
    </Tag>
  );
}
