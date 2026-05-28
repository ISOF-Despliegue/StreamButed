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
    <div className="live-room-shell">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`live-room-video${state === "watching" ? " is-watching" : ""}`}
        onContextMenu={(event) => event.preventDefault()}
      />

      {state !== "watching" ? (
        <div className="live-room-overlay">
          {state === "idle" ? <><div className="live-room-overlay-title">Conectando</div><div>Preparando conexion...</div></> : null}
          {state === "joining" ? <><div className="live-room-overlay-title">Cargando</div><div>Uniendose al concierto...</div></> : null}
          {state === "ended" ? <><div className="live-room-ended-title">El concierto ha terminado</div><button className="live-primary-action" onClick={handleLeave} type="button">Volver</button></> : null}
          {state === "error" ? <><div className="live-room-error-text">{error || "Error al conectar"}</div><button className="live-secondary-action" onClick={handleLeave} type="button">Salir</button></> : null}
        </div>
      ) : null}

      {state === "watching" ? (
        <div className="live-room-controls">
          <span className="live-status-badge">EN VIVO</span>
          <span className="live-room-title">{artistName || "Artista"}{concertTitle ? ` - ${concertTitle}` : ""}</span>
          <span className="live-room-meta">Oyentes: {listenerCount}</span>

          <div className="live-room-actions">
            <button className="live-audio-action" onClick={handleToggleMuted} title={muted ? "Activar audio" : "Silenciar"} type="button">
              {muted ? "Activar audio" : "Silenciar"}
            </button>
            <button className="live-danger-inline-action" onClick={handleLeave} type="button">Salir</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
