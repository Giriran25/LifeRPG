import { useEffect, useRef } from "react";

import { onScrollFrame } from "./scroll-engine";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * The environment every page stands in.
 *
 * Three out-of-focus colour fields — arcane, cyan and gold, the Hello Helper
 * accent triad — drift opposite the cursor and slowly against the scroll. It
 * is the single device that makes navigation feel like moving through one
 * space instead of swapping documents: the field persists across routes while
 * the content above it changes.
 *
 * Rendered fixed and behind everything (z-0), pointer-events:none, aria-hidden.
 * Nothing here is content.
 */
export function AmbientField({
  intensity = 1,
  className,
}: {
  /** 0 → off, 1 → landing-strength. Inner pages sit lower so content leads. */
  intensity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    let pointerX = 0;
    let pointerY = 0;
    let scrollY = 0;
    let frame = 0;

    const apply = () => {
      frame = 0;
      node.style.transform = `translate3d(${pointerX.toFixed(1)}px, ${(pointerY + scrollY).toFixed(
        1,
      )}px, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // Opposite the cursor: the field sits behind the glass, so it lags.
      pointerX = -(event.clientX / window.innerWidth - 0.5) * 26 * intensity;
      pointerY = -(event.clientY / window.innerHeight - 0.5) * 26 * intensity;
      schedule();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    const unsubscribe = onScrollFrame(({ y }) => {
      // Slow vertical drift keeps the field from feeling pinned to the viewport.
      scrollY = y * 0.04 * intensity;
      schedule();
    });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [intensity, reduced]);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
      style={{ opacity: 0.42 * intensity }}
    >
      <div ref={ref} className="absolute inset-0 will-change-transform">
        <div
          className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full blur-[120px]"
          style={{ background: "color-mix(in oklab, var(--accent) 16%, transparent)" }}
        />
        <div
          className="absolute top-1/3 -right-24 h-[620px] w-[620px] rounded-full blur-[140px]"
          style={{ background: "color-mix(in oklab, var(--arcane) 16%, transparent)" }}
        />
        <div
          className="absolute -bottom-24 left-1/3 h-[520px] w-[520px] rounded-full blur-[130px]"
          style={{ background: "color-mix(in oklab, var(--primary) 11%, transparent)" }}
        />
      </div>
    </div>
  );
}
