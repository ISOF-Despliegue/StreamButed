import PropTypes from 'prop-types';
import { IcMusic } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { formatDuration, formatNumber } from '../../utils/formatters';

export function TrackRow({
  track,
  index,
  isPlaying,
  onPlay,
  onArtistClick,
  metaText,
  contextText,
  actions,
  metaLeadingContent,
  actionsPosition = 'end',
}) {
  const trackId = track.trackId || track.id;
  const artistName = track.artist || track.artistName || 'Artista';
  const duration = track.durationSeconds ?? track.duration;
  let meta = metaText;
  if (meta === undefined) {
    if (track.plays === undefined) {
      meta = track.genre || track.status || 'Sin datos';
    } else {
      meta = formatNumber(track.plays);
    }
  }

  return (
    <tr className={`track-row${isPlaying ? ' playing' : ''}`}>
      <td><span className="track-num">{index + 1}</span></td>
      <td>
        <div className="track-title-cell">
          <button className="track-title-button" onClick={onPlay} type="button">
            <div className="track-thumb">
              {track.coverAssetId ? (
                <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
              )}
            </div>
            <div>
              <div className="track-name">{track.title}</div>
            </div>
          </button>
          <button
            className="track-artist-link"
            onClick={() => onArtistClick?.(track.artistId)}
            type="button"
          >
            {artistName}
          </button>
        </div>
      </td>
      {actions !== undefined && actionsPosition === 'before-meta' && (
        <td className="track-actions-cell" onClick={event => event.stopPropagation()}>
          {actions}
        </td>
      )}
      <td>
        <div className="track-meta-cell">
          {metaLeadingContent ? (
            <div className="track-meta-leading">
              {metaLeadingContent}
            </div>
          ) : null}
          <span className="track-meta-text">{meta}</span>
        </div>
      </td>
      {contextText !== undefined && <td style={{ color: 'var(--t3)', fontSize: 13 }}>{contextText}</td>}
      <td className="track-duration-cell"><span className="track-duration">{trackId ? formatDuration(duration) : '--:--'}</span></td>
      {actions !== undefined && actionsPosition !== 'before-meta' && (
        <td className="track-actions-cell" onClick={event => event.stopPropagation()}>
          {actions}
        </td>
      )}
    </tr>
  );
}

TrackRow.propTypes = {
  actions: PropTypes.node,
  actionsPosition: PropTypes.oneOf(['before-meta', 'end']),
  contextText: PropTypes.string,
  index: PropTypes.number.isRequired,
  isPlaying: PropTypes.bool,
  metaLeadingContent: PropTypes.node,
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
