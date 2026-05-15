import { useEffect, useRef, useState } from "react";
import { useListenerLive } from "../../hooks/useListenerLive";
import { useLive } from "../../hooks/useLive";

type ListenerLiveRoomProps = Readonly<{
  roomId: string;
  concertTitle?: string;
  artistName?: string;
  onLeave?: () => void;
}>;

export function ListenerLiveRoom({ roomId, concertTitle, artistName, onLeave }: ListenerLiveRoomProps) {
  const { socket, connectionState } = useLive();
  const { remoteStream, state, error, listenerCount, joinRoom, leaveRoom } = useListenerLive(socket);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !remoteStream) {
      return;
    }

    video.srcObject = remoteStream;
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => undefined);
    });
  }, [remoteStream]);

  useEffect(() => {
    if (socket && connectionState === "connected" && roomId && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      void joinRoom(roomId);
    }
  }, [socket, connectionState, roomId, joinRoom]);

  const handleLeave = () => {
    hasJoinedRef.current = false;
    leaveRoom();
    onLeave?.();
  };

  const handleToggleMuted = () => {
    const nextMuted = !muted;
    const video = videoRef.current;

    setMuted(nextMuted);

    if (video) {
      video.muted = nextMuted;
      void video.play().catch(() => undefined);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#000" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ flex: 1, width: "100%", objectFit: "contain", background: "#000", cursor: state === "watching" ? "none" : "default" }}
        onContextMenu={(event) => event.preventDefault()}
      />

      {state !== "watching" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", color: "#F2EDE6", gap: 16 }}>
          {state === "idle" && <><div style={{ fontSize: 32 }}>Conectando</div><div>Preparando conexion...</div></>}
          {state === "joining" && <><div style={{ fontSize: 32 }}>Cargando</div><div>Uniendose al concierto...</div></>}
          {state === "ended" && <><div style={{ fontSize: 20, fontWeight: 700 }}>El concierto ha terminado</div><button onClick={handleLeave} style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Volver</button></>}
          {state === "error" && <><div style={{ color: "#EF4444" }}>{error || "Error al conectar"}</div><button onClick={handleLeave} style={{ padding: "10px 24px", borderRadius: 8, background: "#1E1E28", border: "1px solid #2E2E3E", color: "#F2EDE6", cursor: "pointer" }}>Salir</button></>}
        </div>
      )}

      {state === "watching" && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "linear-gradient(transparent, rgba(0,0,0,0.8))", opacity: 1, transition: "opacity 0.3s" }}>
          <span style={{ background: "#EF4444", color: "#fff", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>EN VIVO</span>
          <span style={{ color: "#F2EDE6", fontSize: 14, fontWeight: 600 }}>{artistName || "Artista"}{concertTitle ? ` - ${concertTitle}` : ""}</span>
          <span style={{ color: "#9994A0", fontSize: 13 }}>Oyentes: {listenerCount}</span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={handleToggleMuted} title={muted ? "Activar audio" : "Silenciar"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", minWidth: 92, height: 36, borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{muted ? "Activar audio" : "Silenciar"}</button>
            <button onClick={handleLeave} style={{ background: "rgba(239,68,68,0.2)", border: "1px solid #EF4444", color: "#EF4444", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Salir</button>
          </div>
        </div>
      )}
    </div>
  );
}
