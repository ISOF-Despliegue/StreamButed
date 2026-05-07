import { IcMusic, IcHeart, IcShuffle, IcSkipBack, IcPlay, IcSkipFwd, IcRepeat, IcVolume } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { ProgressBar } from '../ui/ProgressBar';

export function BottomPlayer({ track, onExpand, volume, setVolume }) {
  if (!track) return (
    <div className="bottom-player">
      <div className="player-track" style={{ color: 'var(--t3)', fontSize: 13 }}>
        <div className="player-cover"><IcMusic /></div>
        <span>Selecciona una pista del catalogo.</span>
      </div>
    </div>
  );

  const artistName = track.artist || track.artistName || track.artistId || 'Artista';

  return (
    <div className="bottom-player">
      <div className="player-track">
        <div className="player-cover" onClick={onExpand}>
          {track.coverAssetId ? (
            <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20 }}><IcMusic /></div>
          )}
        </div>
        <div className="player-track-info">
          <div className="player-track-name" onClick={onExpand}>{track.title}</div>
          <div className="player-track-artist">{artistName}</div>
        </div>
        <button className="btn-icon" style={{ marginLeft: 8 }}><IcHeart /></button>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button className="btn-icon" disabled title="Streaming pendiente"><IcShuffle /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcSkipBack /></button>
          <button className="play-btn" disabled title="Streaming Service pendiente"><IcPlay /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcSkipFwd /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcRepeat /></button>
        </div>
        <div className="player-progress">
          <span className="progress-time">--:--</span>
          <ProgressBar value={0} max={1} onChange={() => {}} />
          <span className="progress-time right">Servicio pendiente</span>
        </div>
      </div>

      <div className="player-right">
        <button className="btn-icon"><IcVolume /></button>
        <div className="volume-bar" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setVolume(Math.round(((e.clientX - rect.left) / rect.width) * 100));
        }}>
          <div className="volume-fill" style={{ width: `${volume}%` }} />
        </div>
      </div>
    </div>
  );
}
