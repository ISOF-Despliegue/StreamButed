import { IcChevron, IcMusic, IcShuffle, IcSkipBack, IcPlay, IcSkipFwd, IcRepeat, IcVolume } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { ProgressBar } from '../ui/ProgressBar';

export function ExpandedPlayer({ track, queue, onClose, volume, setVolume, onSelectTrack }) {
  if (!track) return null;

  const artistName = track.artist || track.artistName || track.artistId || 'Artista';

  return (
    <div className="expanded-player-overlay">
      <div className="ep-main">
        <button className="ep-close" onClick={onClose}><IcChevron dir="down" /></button>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Player preparado</div>
        <div className="ep-cover">
          {track.coverAssetId ? (
            <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 64 }}><IcMusic /></div>
          )}
        </div>
        <div className="ep-meta">
          <div className="ep-title">{track.title}</div>
          <div className="ep-artist">{artistName}</div>
          <div style={{ color: 'var(--t3)', fontSize: 13, marginTop: 8 }}>Streaming Service aun no esta disponible.</div>
        </div>
        <div className="ep-progress">
          <div className="player-progress" style={{ width: '100%' }}>
            <span className="progress-time">--:--</span>
            <ProgressBar value={0} max={1} onChange={() => {}} />
            <span className="progress-time right">Pendiente</span>
          </div>
        </div>
        <div className="ep-controls">
          <button className="btn-icon" disabled title="Streaming pendiente"><IcShuffle /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcSkipBack /></button>
          <button className="ep-play-btn" disabled title="Streaming Service pendiente"><IcPlay /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcSkipFwd /></button>
          <button className="btn-icon" disabled title="Streaming pendiente"><IcRepeat /></button>
        </div>
        <div className="ep-vol">
          <button className="btn-icon"><IcVolume /></button>
          <div className="volume-bar" style={{ flex: 1 }} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setVolume(Math.round(((e.clientX - rect.left) / rect.width) * 100));
          }}>
            <div className="volume-fill" style={{ width: `${volume}%` }} />
          </div>
        </div>
      </div>

      <div className="ep-sidebar">
        <div className="ep-sidebar-title">En cola</div>
        {queue.map((t) => {
          const id = t.trackId || t.id;
          const activeId = track.trackId || track.id;

          return (
            <div key={id} className={`queue-item${id === activeId ? ' active' : ''}`} onClick={() => onSelectTrack(t)}>
              <div className="queue-thumb">
                {t.coverAssetId ? (
                  <img src={getAssetUrl(t.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}><IcMusic /></div>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="queue-name">{t.title}</div>
                <div className="queue-artist">{t.artist || t.artistName || t.artistId || 'Artista'}</div>
              </div>
              <div className="queue-dur">--:--</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
