import { useCallback, useEffect, useState } from "react";
import { useLive } from "../../hooks/useLive";
import { apiRequest } from "../../services/apiClient";

export interface LiveRoom {
  id: string;
  artistId: string;
  artistName?: string;
  title: string;
  status: "LIVE" | "CREATED" | "ENDED";
  listeners?: number;
  listenerCount?: number;
  createdAt?: string;
}

interface LiveConcertsPageProps {
  userRole?: "listener" | "artist" | "admin" | "LISTENER" | "ARTIST" | "ADMIN" | string;
  onJoinRoom?: (room: LiveRoom) => void;
  onStartBroadcast?: () => void;
}

export function LiveConcertsPage({ userRole, onJoinRoom, onStartBroadcast }: LiveConcertsPageProps) {
  const { token, artist } = useLive();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error("No se encontró token JWT en AuthContext.");
      }

      const data = await apiRequest<LiveRoom[] | { data?: LiveRoom[]; rooms?: LiveRoom[] }>(
        "/live/rooms",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRooms(Array.isArray(data) ? data : data.data || data.rooms || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error al cargar conciertos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("No se encontró token JWT en AuthContext.");
      return;
    }

    void fetchRooms();
    const interval = window.setInterval(fetchRooms, 15_000);

    return () => window.clearInterval(interval);
  }, [token, fetchRooms]);

  const activeRooms = rooms.filter((room) => room.status === "LIVE" || !room.status);
  const canStart = userRole === "ARTIST" || userRole === "artist";

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Conciertos en Vivo</h1>
          <p style={{ fontSize: 13, color: "#9994A0", marginTop: 4 }}>
            {activeRooms.length} {activeRooms.length === 1 ? "concierto activo" : "conciertos activos"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void fetchRooms()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2E2E3E", background: "transparent", color: "#9994A0", cursor: "pointer", fontSize: 13 }}>
            Actualizar
          </button>

          {canStart && onStartBroadcast && (
            <button onClick={onStartBroadcast} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {artist.state === "live" ? "Ver mi Live" : "Iniciar concierto"}
            </button>
          )}
        </div>
      </div>

      {artist.state === "live" && (
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #EF4444", borderRadius: 8, padding: 14, color: "#F2EDE6", fontSize: 14, marginBottom: 16 }}>
          Estás transmitiendo ahora: <strong>{artist.title}</strong>. Puedes volver a Do Live sin perder la transmisión.
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 60, color: "#524E5A" }}>Cargando...</div>}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #EF4444", borderRadius: 8, padding: 16, color: "#EF4444", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && activeRooms.length === 0 && (
        <div style={{ textAlign: "center", padding: 80, color: "#524E5A" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#9994A0" }}>No hay conciertos en vivo ahora</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Vuelve más tarde o{canStart ? " inicia el tuyo" : " espera a que un artista comience"}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {activeRooms.map((room) => (
          <div key={room.id} style={{ background: "#16161D", border: "1px solid #22222E", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "#EF4444", color: "#fff", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>EN VIVO</span>
              <span style={{ fontSize: 12, color: "#524E5A", marginLeft: "auto" }}>Oyentes: {room.listeners ?? room.listenerCount ?? 0}</span>
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{room.title}</div>
              <div style={{ fontSize: 13, color: "#9994A0" }}>{room.artistName || room.artistId}</div>
            </div>

            <button
              onClick={() => onJoinRoom?.(room)}
              disabled={!onJoinRoom}
              style={{ padding: "10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 14, cursor: onJoinRoom ? "pointer" : "not-allowed", marginTop: "auto" }}
            >
              Unirse al concierto
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
