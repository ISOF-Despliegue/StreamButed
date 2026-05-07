import { IcMusic } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';

export function AlbumCard({ album, onClick }) {
  const artistName = album.artist || album.artistName || album.artistId || 'Catalogo';

  return (
    <div className="album-card" onClick={onClick}>
      <div className="album-thumb">
        {album.coverAssetId ? (
          <img src={getAssetUrl(album.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 28, color: 'var(--t3)' }}><IcMusic /></div>
        )}
        <div className="play-overlay" style={{ color: '#fff', fontSize: 32 }}>Play</div>
      </div>
      <div className="album-card-title">{album.title}</div>
      <div className="album-card-artist">{artistName}</div>
    </div>
  );
}
