import { IcMusic, IcHeart, IcShuffle, IcSkipBack, IcPlay, IcPause, IcSkipFwd, IcRepeat, IcVolume } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDuration } from '../../utils/formatters';

export function BottomPlayer({
  track,
  onExpand,
  volume,
  setVolume,
  playback,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  onToggleShuffle
}) {
  if (!track) return (
    <div className="bottom-player">
      <div className="player-track" style={{ color: 'var(--t3)', fontSize: 13 }}>
        <div className="player-cover"><IcMusic /></div>
        <span>Selecciona una pista del catalogo.</span>
      </div>
    </div>
  );

  const artistName = track.artist || track.artistName || 'Artista';
  const progressMax = playback.durationSeconds > 0 ? playback.durationSeconds : 1;
  const playTitle = playback.isPlaying ? 'Pausar' : 'Reproducir';

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
          <button className="play-btn" disabled={playback.isLoading} title={playTitle} onClick={onTogglePlay}>
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
        <div className="player-progress">
          <span className="progress-time">{formatDuration(playback.positionSeconds)}</span>
          <ProgressBar value={playback.positionSeconds} max={progressMax} onChange={onSeek} />
          <span className="progress-time right">
            {playback.error ? 'Error' : formatDuration(playback.durationSeconds || null)}
          </span>
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
