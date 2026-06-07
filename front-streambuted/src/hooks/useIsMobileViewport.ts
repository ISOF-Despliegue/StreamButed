import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 760;

function getMatches() {
  if (globalThis.window === undefined || typeof globalThis.window.matchMedia !== "function") {
    return false;
  }

  return globalThis.window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (globalThis.window === undefined || typeof globalThis.window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = globalThis.window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isMobile;
}
