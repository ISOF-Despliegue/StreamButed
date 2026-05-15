import { IcChevron, IcMusic, IcShuffle, IcSkipBack, IcPlay, IcPause, IcSkipFwd, IcRepeat, IcVolume } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDuration } from '../../utils/formatters';
import PropTypes from 'prop-types';

export function ExpandedPlayer({
  track,
  queue,
  onClose,
  volume,
  setVolume,
  onSelectTrack,
  playback,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  onToggleShuffle
}) {
  if (!track) return null;

  const artistName = track.artist || track.artistName || 'Artista';
  const progressMax = playback.durationSeconds > 0 ? playback.durationSeconds : 1;
  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

    setVolume(Math.round(pct * 100));
  };

  return (
    <div className="expanded-player-overlay">
      <div className="ep-main">
        <button className="ep-close" onClick={onClose}><IcChevron dir="down" /></button>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20, textTransform: 'uppercase' }}>
          {playback.isLoading ? 'Cargando audio' : 'Reproduccion'}
        </div>
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
          {playback.error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{playback.error}</div>
          )}
        </div>
        <div className="ep-progress">
          <div className="player-progress" style={{ width: '100%' }}>
            <span className="progress-time">{formatDuration(playback.positionSeconds)}</span>
            <ProgressBar value={playback.positionSeconds} max={progressMax} onChange={onSeek} />
            <span className="progress-time right">{formatDuration(playback.durationSeconds || null)}</span>
          </div>
        </div>
        <div className="ep-controls">
          <button
            className="btn-icon"
            disabled={!playback.canUseAlbumControls}
            title="Aleatorio del album"
            aria-pressed={playback.shuffleEnabled}
            onClick={onToggleShuffle}
          >
            <IcShuffle />
          </button>
          <button
            className="btn-icon"
            disabled={!playback.canUseAlbumControls}
            title="Pista anterior"
            onClick={onPrevious}
          >
            <IcSkipBack />
          </button>
          <button className="ep-play-btn" disabled={playback.isLoading} title="Reproducir o pausar" onClick={onTogglePlay}>
            {playback.isPlaying ? <IcPause /> : <IcPlay />}
          </button>
          <button
            className="btn-icon"
            disabled={!playback.canUseAlbumControls}
            title="Siguiente pista"
            onClick={onNext}
          >
            <IcSkipFwd />
          </button>
          <button className="btn-icon" disabled title="Repetir"><IcRepeat /></button>
        </div>
        <div className="ep-vol">
          <button className="btn-icon"><IcVolume /></button>
          <button
            aria-label="Cambiar volumen"
            className="volume-bar"
            onClick={handleVolumeClick}
            style={{ flex: 1 }}
            type="button"
          >
            <div className="volume-fill" style={{ width: `${volume}%` }} />
          </button>
        </div>
      </div>

      <div className="ep-sidebar">
        <div className="ep-sidebar-title">En cola</div>
        {queue.map((t) => {
          const id = t.trackId || t.id;
          const activeId = track.trackId || track.id;

          return (
            <button
              className={`queue-item${id === activeId ? ' active' : ''}`}
              key={id}
              onClick={() => onSelectTrack(t)}
              type="button"
            >
              <div className="queue-thumb">
                {t.coverAssetId ? (
                  <img src={getAssetUrl(t.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}><IcMusic /></div>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="queue-name">{t.title}</div>
                <div className="queue-artist">{t.artist || t.artistName || 'Artista'}</div>
              </div>
              <div className="queue-dur">--:--</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const playerTrackPropType = PropTypes.shape({
  artist: PropTypes.string,
  artistName: PropTypes.string,
  coverAssetId: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string,
  trackId: PropTypes.string,
});

ExpandedPlayer.propTypes = {
  onClose: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  onSeek: PropTypes.func.isRequired,
  onSelectTrack: PropTypes.func.isRequired,
  onTogglePlay: PropTypes.func.isRequired,
  onToggleShuffle: PropTypes.func.isRequired,
  playback: PropTypes.shape({
    canUseAlbumControls: PropTypes.bool,
    durationSeconds: PropTypes.number,
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    isPlaying: PropTypes.bool,
    positionSeconds: PropTypes.number,
    shuffleEnabled: PropTypes.bool,
  }).isRequired,
  queue: PropTypes.arrayOf(playerTrackPropType).isRequired,
  setVolume: PropTypes.func.isRequired,
  track: playerTrackPropType,
  volume: PropTypes.number.isRequired,
};
