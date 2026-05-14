import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const LIVE_WS_PATH = "/live/ws/socket.io";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface UseLiveSocketReturn {
  socket: Socket | null;
  connectionState: ConnectionState;
}

export function useLiveSocket(token: string | null): UseLiveSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketState(null);
      setConnectionState("idle");
      return;
    }

    setConnectionState("connecting");

    const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || "http://localhost";
    const socket = io(gatewayUrl, {
      path: LIVE_WS_PATH,
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const handleConnect = () => setConnectionState("connected");
    const handleDisconnect = () => setConnectionState("disconnected");
    const handleConnectError = (error: Error) => {
      console.error("live socket connect_error:", error.message);
      setConnectionState("error");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socketRef.current = socket;
    setSocketState(socket);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
      setConnectionState("idle");
    };
  }, [token]);

  return { socket: socketState, connectionState };
}
