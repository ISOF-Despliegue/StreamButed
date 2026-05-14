import { createContext } from "react";
import type { Socket } from "socket.io-client";
import type { ArtistLiveState } from "../hooks/useArtistLive";
import type { ConnectionState } from "../hooks/useLiveSocket";

export interface LiveContextValue {
  token: string | null;
  socket: Socket | null;
  connectionState: ConnectionState;
  artist: {
    localStream: MediaStream | null;
    state: ArtistLiveState;
    error: string | null;
    roomId: string | null;
    title: string | null;
    listenerCount: number;
    goLive: (title: string) => Promise<void>;
    endLive: () => Promise<void>;
    clearError: () => void;
  };
}

export const LiveContext = createContext<LiveContextValue | null>(null);
