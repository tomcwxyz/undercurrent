import { useEffect } from "react";

/**
 * Calls callback when Escape is pressed while active.
 */
export function useEscapeKey(active: boolean, callback: () => void) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        callback();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, callback]);
}
