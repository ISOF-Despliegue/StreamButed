import { IcMusic } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { formatDuration, formatNumber } from '../../utils/formatters';

export function TrackRow({ track, index, isPlaying, onPlay, onArtistClick, metaText }) {
  const trackId = track.trackId || track.id;
  const artistName = track.artist || track.artistName || track.artistId || 'Artista';
  const duration = track.durationSeconds ?? track.duration;
  const meta = metaText !== undefined
    ? metaText
    : (track.plays !== undefined ? formatNumber(track.plays) : (track.genre || track.status || 'Catalogo'));

  return (
    <tr className={`track-row${isPlaying ? ' playing' : ''}`} onClick={onPlay}>
      <td><span className="track-num">{isPlaying ? '*' : index + 1}</span></td>
      <td>
        <div className="track-title-cell">
          <div className="track-thumb">
            {track.coverAssetId ? (
              <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
            )}
          </div>
          <div>
            <div className="track-name">{track.title}</div>
            <div className="track-artist-link" onClick={e => { e.stopPropagation(); onArtistClick && onArtistClick(track.artistId); }}>{artistName}</div>
          </div>
        </div>
      </td>
      <td style={{ color: 'var(--t3)', fontSize: 13 }}>{meta}</td>
      <td><span className="track-duration">{trackId ? formatDuration(duration) : '--:--'}</span></td>
    </tr>
  );
}
