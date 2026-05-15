import { IcMusic } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { formatDuration, formatNumber } from '../../utils/formatters';
import PropTypes from 'prop-types';

export function TrackRow({ track, index, isPlaying, onPlay, onArtistClick, metaText, contextText }) {
  const trackId = track.trackId || track.id;
  const artistName = track.artist || track.artistName || 'Artista';
  const duration = track.durationSeconds ?? track.duration;
  let meta = metaText;

  if (meta === undefined) {
    meta = track.plays !== undefined
      ? formatNumber(track.plays)
      : track.genre || track.status || 'Catalogo';
  }

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
            <button
              className="track-artist-link"
              onClick={e => {
                e.stopPropagation();
                onArtistClick?.(track.artistId);
              }}
              type="button"
            >
              {artistName}
            </button>
          </div>
        </div>
      </td>
      <td style={{ color: 'var(--t3)', fontSize: 13 }}>{meta}</td>
      {contextText !== undefined && <td style={{ color: 'var(--t3)', fontSize: 13 }}>{contextText}</td>}
      <td className="track-duration-cell"><span className="track-duration">{trackId ? formatDuration(duration) : '--:--'}</span></td>
    </tr>
  );
}

TrackRow.propTypes = {
  contextText: PropTypes.string,
  index: PropTypes.number.isRequired,
  isPlaying: PropTypes.bool,
  metaText: PropTypes.string,
  onArtistClick: PropTypes.func,
  onPlay: PropTypes.func.isRequired,
  track: PropTypes.shape({
    albumId: PropTypes.string,
    artist: PropTypes.string,
    artistId: PropTypes.string,
    artistName: PropTypes.string,
    audioAssetId: PropTypes.string,
    coverAssetId: PropTypes.string,
    duration: PropTypes.number,
    durationSeconds: PropTypes.number,
    genre: PropTypes.string,
    id: PropTypes.string,
    plays: PropTypes.number,
    status: PropTypes.string,
    title: PropTypes.string,
    trackId: PropTypes.string,
  }).isRequired,
};
