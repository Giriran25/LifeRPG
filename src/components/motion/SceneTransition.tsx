import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Route changes as camera moves, not page swaps.
 *
 * The outgoing scene sinks back slightly and dims while the incoming scene
 * rises into the same frame. Because the ambient field, grain and chrome all
 * sit outside this wrapper, only the *content* moves — which is what sells the
 * feeling of travelling within one world rather than loading a new document.
 *
 * Keyed on pathname, so it is inert during search-param updates (filters,
 * dialogs) that should not read as leaving the room.
 */
export function SceneTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [scene, setScene] = useState({ key: pathname, children });
  const [entering, setEntering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (scene.key === pathname) {
      // Same route, new data — swap content without replaying the transition.
      setScene({ key: pathname, children });
      return;
    }

    setScene({ key: pathname, children });
    setEntering(true);
    window.clearTimeout(timer.current);
    timer.current = setTimeout(() => setEntering(false), 30);

    return () => window.clearTimeout(timer.current);
    // `children` is intentionally excluded: only pathname drives the transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, children]);

  return (
    <div
      key={scene.key}
      className={cn("scene-frame", entering ? "scene-frame-enter" : "scene-frame-settled")}
    >
      {scene.children}
    </div>
  );
}
