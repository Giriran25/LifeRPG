import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/** Ease-out cubic: fast departure, long settle — reads as a counter landing. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts to `value` whenever it changes, so XP and gold are seen *moving* into
 * the player's totals rather than silently re-rendering. On first mount it
 * counts up from zero; on later changes it animates from the previous value,
 * which makes a reward land as a visible delta.
 *
 * Under reduced motion the number is written directly — the information is
 * identical, only the travel is removed.
 */
export function CountUp({
  value,
  duration = 900,
  format = (n: number) => String(Math.round(n)),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) {
      previous.current = value;
      setDisplay(value);
      return;
    }

    const from = previous.current;
    const to = value;
    previous.current = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * easeOut(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, reduced]);

  return (
    <span className={cn("num tabular-nums", className)} aria-label={format(value)}>
      <span aria-hidden>{format(display)}</span>
    </span>
  );
}
