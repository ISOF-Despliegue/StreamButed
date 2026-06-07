import { useEffect, useRef, useState } from "react";
import { useLive } from "../../hooks/useLive";

export function ArtistLiveRoom() {
  const { connectionState, artist } = useLive();
  const { localStream, state, error, title: activeTitle, listenerCount, goLive, endLive, clearError } =
    artist;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleGoLive = () => {
    if (!title.trim()) {
      return;
    }

    clearError();
    void goLive(title.trim());
  };

  const isLive = state === "live";
  const canStart =
    Boolean(title.trim()) && connectionState === "connected" && ["idle", "ended", "error"].includes(state);
  const isTransitioning = ["requesting-media", "connecting", "ending"].includes(state);

  return (
    <div className="live-page-shell">
      <div className="live-page-header">
        <span className="live-page-title">StreamButed en vivo</span>
        {isLive ? <span className="live-status-badge">EN VIVO</span> : null}
      </div>

      <div className="live-page-layout">
        <div className="live-preview-panel">
          {localStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="live-preview-video"
            />
          ) : (
            <div className="live-preview-empty">
              <div className="live-preview-empty-title">Video</div>
              <div>{state === "requesting-media" ? "Accediendo a camara..." : "La camara aparecera aqui"}</div>
            </div>
          )}

          {state === "connecting" ? (
            <div className="live-preview-overlay">
              Conectando...
            </div>
          ) : null}
        </div>

        <div className="live-side-panel">
          {isLive ? (
            <>
              <div className="live-info-card">
                <div className="live-info-label">Titulo</div>
                <div className="live-info-value">{activeTitle || title}</div>
                <div className="live-info-label live-info-gap">Oyentes</div>
                <div className="live-info-value">{listenerCount}</div>
              </div>

              <button
                onClick={() => void endLive()}
                className="live-danger-action"
                type="button"
              >
                Terminar concierto
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="live-field-label" htmlFor="artist-live-title">Titulo del concierto</label>
                <input
                  id="artist-live-title"
                  type="text"
                  placeholder="Ej: Sesion acustica en vivo"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && canStart && handleGoLive()}
                  maxLength={100}
                  disabled={state === "requesting-media" || state === "connecting"}
                  className="live-input"
                />
              </div>

              <button
                onClick={handleGoLive}
                disabled={!canStart}
                className="live-primary-action"
                type="button"
              >
                Iniciar concierto
              </button>
            </>
          )}

          {isTransitioning ? (
            <div className="live-help-text">
              {state === "requesting-media" && "Solicitando acceso a camara y microfono..."}
              {state === "connecting" && "Estableciendo conexion..."}
              {state === "ending" && "Terminando transmision..."}
            </div>
          ) : null}

          {error ? (
            <div className="live-error-box">
              {error}
            </div>
          ) : null}

          <div className="live-footnote">
            La transmision usa camara y microfono en tiempo real.<br />
            Puedes navegar a En vivo sin cortar la transmision; solo termina con el boton.
          </div>
        </div>
      </div>
    </div>
  );
}
