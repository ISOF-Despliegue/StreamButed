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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0A0A0D", color: "#F2EDE6" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #22222E", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>StreamButed Live</span>
        {isLive && (
          <span style={{ background: "#EF4444", color: "#fff", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
            EN VIVO
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#524E5A" }}>Socket: {connectionState}</span>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 24, padding: 24 }}>
        <div style={{ flex: 1, background: "#16161D", borderRadius: 12, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {localStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "#524E5A" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>Video</div>
              <div>{state === "requesting-media" ? "Accediendo a cámara..." : "La cámara aparecerá aquí"}</div>
            </div>
          )}

          {state === "connecting" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--accent)" }}>
              Conectando al servidor...
            </div>
          )}
        </div>

        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLive ? (
            <>
              <div>
                <label style={{ fontSize: 13, color: "#9994A0", display: "block", marginBottom: 6 }}>Título del concierto</label>
                <input
                  type="text"
                  placeholder="Ej: Sesión acústica en vivo"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && canStart && handleGoLive()}
                  maxLength={100}
                  disabled={state === "requesting-media" || state === "connecting"}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#1E1E28",
                    border: "1px solid #2E2E3E",
                    borderRadius: 8,
                    color: "#F2EDE6",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <button
                onClick={handleGoLive}
                disabled={!canStart}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: canStart ? "var(--accent)" : "#252533",
                  color: canStart ? "#000" : "#524E5A",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: canStart ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                Iniciar concierto
              </button>
            </>
          ) : (
            <>
              <div style={{ background: "#1E1E28", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#9994A0", marginBottom: 4 }}>Título</div>
                <div style={{ fontWeight: 600 }}>{activeTitle || title}</div>
                <div style={{ fontSize: 12, color: "#9994A0", marginTop: 12, marginBottom: 4 }}>Oyentes</div>
                <div style={{ fontWeight: 700, color: "#F2EDE6" }}>{listenerCount}</div>
              </div>

              <button
                onClick={() => void endLive()}
                style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid #EF4444", background: "transparent", color: "#EF4444", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Terminar concierto
              </button>
            </>
          )}

          {!["idle", "ended", "error", "live"].includes(state) && (
            <div style={{ color: "#9994A0", fontSize: 14 }}>
              {state === "requesting-media" && "Solicitando acceso a cámara y micrófono..."}
              {state === "connecting" && "Estableciendo conexión WebRTC..."}
              {state === "ending" && "Terminando transmisión..."}
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #EF4444", borderRadius: 8, padding: 12, fontSize: 13, color: "#EF4444" }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: "auto", fontSize: 11, color: "#524E5A", lineHeight: 1.5 }}>
            La transmisión usa cámara y micrófono en tiempo real.<br />
            Puedes navegar a Lives sin cortar el Live; solo termina con el botón.
          </div>
        </div>
      </div>
    </div>
  );
}
