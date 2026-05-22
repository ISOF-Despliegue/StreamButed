import { IcMusic, IcPlay } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import PropTypes from 'prop-types';

export function AlbumCard({ album, onClick }) {
  const artistName = album.artist || album.artistName || 'Artista';

  return (
    <button className="album-card" onClick={onClick} type="button">
      <div className="album-thumb">
        {album.coverAssetId ? (
          <img src={getAssetUrl(album.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 28, color: 'var(--t3)' }}><IcMusic /></div>
        )}
        <div className="play-overlay" aria-hidden="true">
          <span className="album-play-icon"><IcPlay /></span>
        </div>
      </div>
      <div className="album-card-title">{album.title}</div>
      <div className="album-card-artist">{artistName}</div>
    </button>
  );
}

AlbumCard.propTypes = {
  album: PropTypes.shape({
    albumId: PropTypes.string,
    artist: PropTypes.string,
    artistName: PropTypes.string,
    coverAssetId: PropTypes.string,
    title: PropTypes.string,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
};
