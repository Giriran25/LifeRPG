import {
  useCallback,
  useRef,
  type CSSProperties,
  type ElementType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Pointer-responsive depth. The surface tilts a couple of degrees toward the
 * cursor and a specular sheen tracks the same point, so hovering reads as
 * "this object is in front of the page" rather than "this element changed
 * background colour".
 *
 * The tilt is deliberately small (default 6deg): enough to sell depth on a
 * 400px card, never enough to make text swim. Touch pointers are ignored —
 * there is no hover state to express — and the whole effect is skipped under
 * reduced motion, leaving the border/glow states to carry focus instead.
 */
export function TiltCard({
  children,
  maxTilt = 6,
  lift = 6,
  sheen = true,
  className,
  style,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  maxTilt?: number;
  lift?: number;
  sheen?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const reduced = usePrefersReducedMotion();

  const handleMove = useCallback(
    (event: ReactPointerEvent) => {
      if (reduced || event.pointerType === "touch") return;
      const node = ref.current;
      if (!node) return;

      const { clientX, clientY } = event;
      if (frame.current) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const rect = node.getBoundingClientRect();
        // -0.5 → 0.5 across each axis of the card.
        const px = (clientX - rect.left) / rect.width - 0.5;
        const py = (clientY - rect.top) / rect.height - 0.5;

        node.style.transform = `perspective(900px) rotateX(${(-py * maxTilt).toFixed(
          2,
        )}deg) rotateY(${(px * maxTilt).toFixed(2)}deg) translate3d(0, ${-lift}px, 0)`;
        node.style.setProperty("--sheen-x", `${((px + 0.5) * 100).toFixed(1)}%`);
        node.style.setProperty("--sheen-y", `${((py + 0.5) * 100).toFixed(1)}%`);
      });
    },
    [maxTilt, lift, reduced],
  );

  const handleLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    node.style.transform = "";
    node.style.removeProperty("--sheen-x");
    node.style.removeProperty("--sheen-y");
  }, []);

  return (
    <Tag
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn("tilt-surface", sheen && "tilt-sheen", className)}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
