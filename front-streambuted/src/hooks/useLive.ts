import { useContext } from "react";
import { LiveContext } from "../context/liveContextValue";

export function useLive() {
  const context = useContext(LiveContext);

  if (!context) {
    throw new Error("useLive must be used inside LiveProvider.");
  }

  return context;
}
