import { useMemo, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useArtistLive } from "../hooks/useArtistLive";
import { useLiveSocket } from "../hooks/useLiveSocket";
import { LiveContext, type LiveContextValue } from "./liveContextValue";

type LiveProviderProps = Readonly<{
  children: ReactNode;
}>;

function readStoredToken(): string | null {
  return (
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt") ||
    null
  );
}

export function LiveProvider({ children }: LiveProviderProps) {
  const { accessToken } = useAuth();
  const token = accessToken || readStoredToken();
  const { socket, connectionState } = useLiveSocket(token);
  const artist = useArtistLive(socket);

  const value = useMemo<LiveContextValue>(
    () => ({
      token,
      socket,
      connectionState,
      artist,
    }),
    [token, socket, connectionState, artist]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
