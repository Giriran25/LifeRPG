import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type RevealFrom = "below" | "left" | "right" | "scale" | "blur";

const ENTER_TRANSFORM: Record<RevealFrom, string> = {
  below: "translate3d(0, 28px, 0)",
  left: "translate3d(-32px, 0, 0)",
  right: "translate3d(32px, 0, 0)",
  scale: "scale(0.94)",
  blur: "translate3d(0, 14px, 0)",
};

/**
 * A scene arrives rather than appears: the element holds an offset pose until
 * it crosses into view, then settles once. Direction carries meaning — content
 * entering from the left is upstream of content entering from the right, and
 * `scale` reads as the camera pushing in on a focal object.
 *
 * Reduced motion is handled by the global `prefers-reduced-motion` guard in
 * styles.css, which collapses the transition to 1ms and clears the transform,
 * so the content is never hidden from anyone.
 */
export function SceneReveal({
  children,
  from = "below",
  delay = 0,
  duration = 700,
  once = true,
  threshold = 0.12,
  className,
  style,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  from?: RevealFrom;
  delay?: number;
  duration?: number;
  once?: boolean;
  threshold?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      /*
       * The bottom margin is 0 deliberately. An inset bottom margin looks
       * tidier on a long page, but it creates a dead band at the foot of a
       * SHORT one: an element sitting inside that band can never satisfy the
       * observer, and because a reveal starts at opacity 0 the content stays
       * permanently invisible. Revealing a little earlier is a far cheaper
       * cost than losing content, so the viewport edge is the trigger.
       */
      { rootMargin: "0px", threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <Tag
      ref={ref}
      className={cn("scene-reveal", shown && "scene-reveal-in", className)}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
        ...(shown ? undefined : { transform: ENTER_TRANSFORM[from] }),
        ...(from === "blur" && !shown ? { filter: "blur(6px)" } : undefined),
        ...style,
      }}
      // A reveal is a presentational wrapper around real content, so anything
      // semantic the caller sets on it — aria-label, aria-live, role, id — has
      // to reach the rendered element rather than being swallowed here.
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Sequences a list so items arrive one after another instead of as a block.
 * The stagger is capped so a long ledger never leaves the last row waiting.
 */
export function Stagger({
  children,
  step = 70,
  from = "below",
  baseDelay = 0,
  maxDelay = 520,
  className,
  as: Tag = "div",
  itemAs = "div",
}: {
  children: ReactNode[];
  step?: number;
  from?: RevealFrom;
  baseDelay?: number;
  maxDelay?: number;
  className?: string;
  as?: ElementType;
  itemAs?: ElementType;
}) {
  return (
    <Tag className={className}>
      {children.map((child, index) => (
        <SceneReveal
          key={index}
          as={itemAs}
          from={from}
          delay={Math.min(maxDelay, baseDelay + index * step)}
        >
          {child}
        </SceneReveal>
      ))}
    </Tag>
  );
}
