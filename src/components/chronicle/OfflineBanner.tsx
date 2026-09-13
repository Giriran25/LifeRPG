import { useEffect, useState } from "react";

import { MetaLabel } from "./MetaLabel";

/**
 * Going offline must never look like a quiet failure. The banner says so
 * plainly and the mutation hooks refuse to fire while it is up.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine !== false);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="border-ember/40 bg-ember/10 border-y px-4 py-2 text-center sm:px-6"
    >
      <MetaLabel tone="var(--ember)">Offline · changes will not save</MetaLabel>
    </div>
  );
}
