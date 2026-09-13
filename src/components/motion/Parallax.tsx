import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

import { onScrollFrame, viewportProgress } from "./scroll-engine";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Moves its children against the scroll direction, so the layer reads as
 * sitting behind (or in front of) the page rather than glued to it.
 *
 * `depth` is the displacement in px across one full viewport of travel:
 * negative values trail the scroll (background), positive lead it (foreground).
 * Only `transform` is written, and only inside a rAF tick shared with every
 * other parallax layer on the page.
 */
export function Parallax({
  children,
  depth = -40,
  scaleRange = 0,
  fade = false,
  className,
  style,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  /** px of vertical drift across one viewport of scroll. */
  depth?: number;
  /** Optional scale delta applied across the same range (0 = no scaling). */
  scaleRange?: number;
  /** Fade the layer out as it leaves the viewport centre. */
  fade?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    return onScrollFrame(({ vh }) => {
      const rect = node.getBoundingClientRect();
      // Skip work for layers far outside the viewport.
      if (rect.bottom < -vh || rect.top > vh * 2) return;

      const progress = viewportProgress(rect, vh);
      const translate = progress * depth;
      const scale = 1 + progress * scaleRange;

      node.style.transform = `translate3d(0, ${translate.toFixed(2)}px, 0)${
        scaleRange ? ` scale(${scale.toFixed(4)})` : ""
      }`;
      if (fade) {
        node.style.opacity = String(Math.max(0, 1 - Math.abs(progress) * 0.85));
      }
    });
  }, [depth, scaleRange, fade, reduced]);

  return (
    <Tag
      ref={ref}
      className={cn("will-change-transform", className)}
      style={style}
      data-parallax=""
      {...rest}
    >
      {children}
    </Tag>
  );
}
