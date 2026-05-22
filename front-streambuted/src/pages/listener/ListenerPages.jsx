import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IcMusic, IcSearch } from '../../components/icons/Icons';
import { AlbumCard } from '../../components/ui/AlbumCard';
import { TrackRow } from '../../components/ui/TrackRow';
import { catalogService } from '../../services/catalogService';
import { getAssetUrl } from '../../services/mediaService';
import { routes } from '../../routes/appRoutes';
import { browserLogger } from '../../utils/browserLogger';
import { formatDate } from '../../utils/formatters';
import { toUserFacingMessage } from '../../utils/userFacingMessages';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return 'No se pudo cargar la información.';
}

function getCatalogStatusLabel(status) {
  return status === 'RETIRADO' ? 'Retirado' : 'Publicado';
}

function InlineState({ title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-text">{title}</div>
      {message && <div className="empty-sub">{message}</div>}
    </div>
  );
}

async function getArtistNamesById(items) {
  const artistIds = Array.from(new Set(
    items
      .map(item => item.artistId)
      .filter(Boolean)
  ));

  const entries = await Promise.all(
    artistIds.map(async (artistId) => {
      try {
        const artist = await catalogService.getArtist(artistId);
        return [artistId, artist.displayName];
      } catch (error) {
        browserLogger.warn(`Failed to load artist ${artistId} while enriching listener data.`, error);
        return [artistId, null];
      }
    })
  );

  return Object.fromEntries(entries.filter(([, displayName]) => Boolean(displayName)));
}

function withArtistNames(items, artistNamesById) {
  return items.map(item => ({
    ...item,
    artist: artistNamesById[item.artistId] ?? item.artist ?? item.artistName ?? 'Artista',
  }));
}

async function getAlbumTitlesById(tracks, knownAlbums = []) {
  const titlesById = Object.fromEntries(
    knownAlbums
      .filter(album => album.albumId && album.title)
      .map(album => [album.albumId, album.title])
  );

  const missingAlbumIds = Array.from(new Set(
    tracks
      .map(track => track.albumId)
      .filter(albumId => albumId && !titlesById[albumId])
  ));

  const entries = await Promise.all(
    missingAlbumIds.map(async (albumId) => {
      try {
        const album = await catalogService.getAlbum(albumId);
        return [albumId, album.title];
      } catch (error) {
        browserLogger.warn(`Failed to load album ${albumId} while enriching listener data.`, error);
        return [albumId, null];
      }
    })
  );

  return {
    ...titlesById,
    ...Object.fromEntries(entries.filter(([, title]) => Boolean(title))),
  };
}

function withAlbumContext(tracks, albumTitlesById) {
  return tracks.map(track => ({
    ...track,
    albumTitle: track.albumId && albumTitlesById[track.albumId] ? albumTitlesById[track.albumId] : 'Sencillo',
  }));
}

export function HomePage() {
  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Inicio</div>
        <div className="page-subtitle">
          Explora música, artistas y álbumes publicados en StreamButed.
        </div>
      </div>

      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Descubre música nueva</div>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          Busca canciones, visita perfiles de artistas y reproduce álbumes completos desde un solo lugar.
        </p>
        <Link className="btn-primary" to={routes.search}>
          Buscar música
        </Link>
      </div>
    </div>
  );
}

export function SearchPage({ onPlayTrack, currentTrack }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ artists: [], albums: [], tracks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setResults({ artists: [], albums: [], tracks: [] });
      setError('');
      setHasSearched(false);
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;

    const timeoutId = globalThis.setTimeout(async () => {
      if (!isActive) return;

      setIsLoading(true);
      setError('');
      setHasSearched(true);

      try {
        const response = await catalogService.searchCatalog({
          q: normalizedQuery,
          limit: 20,
          offset: 0,
        });
        const artistNamesById = await getArtistNamesById([
          ...(response.albums ?? []),
          ...(response.tracks ?? []),
        ]);
        const albums = withArtistNames(response.albums ?? [], artistNamesById);
        const albumTitlesById = await getAlbumTitlesById(response.tracks ?? [], albums);
        const tracks = withAlbumContext(withArtistNames(response.tracks ?? [], artistNamesById), albumTitlesById);

        if (!isActive) return;
        setResults({
          artists: response.artists ?? [],
          albums,
          tracks,
        });
      } catch (err) {
        if (isActive) setError(getErrorMessage(err));
      } finally {
        if (isActive) setIsLoading(false);
      }
    }, 300);

    return () => {
      isActive = false;
      globalThis.clearTimeout(timeoutId);
    };
  }, [query]);

  const isEmpty = useMemo(
    () => hasSearched && !isLoading && !error && !results.artists.length && !results.albums.length && !results.tracks.length,
    [error, hasSearched, isLoading, results]
  );

  return (
    <div>
      <div className="search-header">
        <div className="search-input-wrap">
          <span className="search-icon"><IcSearch /></span>
          <input
            type="text"
            placeholder="Busca canciones, artistas, álbumes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="page-inner" style={{ paddingTop: 24 }}>
        {!query.trim() && (
          <InlineState
            title="Busca en StreamButed"
            message="Encuentra canciones, artistas y álbumes por nombre."
          />
        )}

        {isLoading && <InlineState title="Buscando..." message="Estamos revisando la música disponible." />}
        {error && <InlineState title="No se pudo buscar" message={error} />}
        {isEmpty && <InlineState title="Sin resultados" message="No encontramos coincidencias para esta búsqueda." />}

        {results.artists.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">Artistas</div>
            </div>
            <div className="album-grid">
              {results.artists.map((artist) => (
                <button
                  key={artist.artistId}
                  className="album-card"
                  onClick={() => navigate(routes.artistProfile(artist.artistId))}
                  type="button"
                >
                  <div className="album-thumb">
                    {artist.profileImageAssetId ? (
                      <img src={getAssetUrl(artist.profileImageAssetId)} alt={`Foto de ${artist.displayName}`} />
                    ) : (
                      <div style={{ fontSize: 28, color: 'var(--t3)' }}><IcMusic /></div>
                    )}
                  </div>
                  <div className="album-card-title">{artist.displayName}</div>
                  <div className="album-card-artist">Artista</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.tracks.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">Pistas</div>
            </div>
            <table className="track-list" style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 40 }}>#</th>
                <th>Título</th>
                <th>Género</th>
                <th>Álbum</th>
                <th className="track-duration-col">Duración</th>
              </tr></thead>
              <tbody>
                {results.tracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    onPlay={() => onPlayTrack(track)}
                    onArtistClick={artistId => navigate(routes.artistProfile(artistId))}
                    metaText={track.genre || 'Sin género'}
                    contextText={track.albumTitle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results.albums.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">Álbumes</div>
            </div>
            <div className="album-grid">
              {results.albums.map(album => (
                <AlbumCard
                  key={album.albumId}
                  album={album}
                  onClick={() => navigate(routes.album(album.albumId))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AlbumDetailPage({ albumId, onPlayTrack, currentTrack }) {
  const navigate = useNavigate();
  const [album, setAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!albumId) return undefined;

    let mounted = true;
    setIsLoading(true);
    setError('');

    Promise.all([
      catalogService.getAlbum(albumId),
      catalogService.listAlbumTracks(albumId),
    ])
      .then(async ([albumResponse, trackResponse]) => {
        if (!mounted) return;
        const artistNamesById = await getArtistNamesById([
          albumResponse,
          ...(trackResponse.tracks ?? []),
        ]);
        if (!mounted) return;
        setAlbum(withArtistNames([albumResponse], artistNamesById)[0]);
        const tracksWithArtists = withArtistNames(trackResponse.tracks ?? [], artistNamesById);
        setTracks(tracksWithArtists);
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [albumId]);

  if (!albumId) {
    return <div className="page-inner"><InlineState title="Álbum no seleccionado" /></div>;
  }

  if (isLoading) {
    return <div className="page-inner"><InlineState title="Cargando álbum..." /></div>;
  }

  if (error) {
    return <div className="page-inner"><InlineState title="No se pudo cargar el álbum" message={error} /></div>;
  }

  if (!album) {
    return <div className="page-inner"><InlineState title="Álbum no encontrado" /></div>;
  }

  return (
    <div>
      <div className="album-hero">
        <div className="album-hero-cover">
          {album.coverAssetId ? (
            <img src={getAssetUrl(album.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 56 }}><IcMusic /></div>
          )}
        </div>
        <div className="album-hero-info">
          <div className="album-hero-type">Álbum</div>
          <div className="album-hero-title">{album.title}</div>
          <div className="album-hero-meta">
            <button
              className="inline-link-button"
              onClick={() => navigate(routes.artistProfile(album.artistId))}
              type="button"
            >
              {album.artist || 'Artista'}
            </button>
            <span className="dot-sep" />
            <span>{getCatalogStatusLabel(album.status)}</span>
            <span className="dot-sep" />
            <span>{formatDate(album.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="page-inner">
        {tracks.length === 0 ? (
          <InlineState title="Sin pistas publicadas" />
        ) : (
          <table className="track-list">
            <thead><tr>
              <th style={{ width: 40 }}>#</th>
              <th>Título</th>
              <th>Género</th>
              <th className="track-duration-col">Duración</th>
            </tr></thead>
            <tbody>
              {tracks.map((track, index) => (
                <TrackRow
                  key={track.trackId}
                  track={track}
                  index={index}
                  isPlaying={currentTrack?.trackId === track.trackId}
                  onPlay={() => onPlayTrack(
                    track,
                    tracks,
                    album.albumId
                  )}
                  onArtistClick={artistId => navigate(routes.artistProfile(artistId))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ArtistProfilePage({ artistId, currentUser, onPlayTrack, currentTrack }) {
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!artistId) return undefined;

    let mounted = true;
    setIsLoading(true);
    setError('');

    Promise.all([
      catalogService.getArtist(artistId),
      catalogService.listArtistTracks(artistId),
      catalogService.listArtistAlbums(artistId),
    ])
      .then(([artistResponse, trackResponse, albumResponse]) => {
        if (!mounted) return;
        setArtist(artistResponse);
        setTracks(trackResponse);
        setAlbums(albumResponse);
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [artistId]);

  if (!artistId) {
    return <div className="page-inner"><InlineState title="Artista no seleccionado" /></div>;
  }

  if (isLoading) {
    return <div className="page-inner"><InlineState title="Cargando artista..." /></div>;
  }

  if (error) {
    return <div className="page-inner"><InlineState title="No se pudo cargar el artista" message={error} /></div>;
  }

  if (!artist) {
    return <div className="page-inner"><InlineState title="Artista no encontrado" /></div>;
  }

  const isOwnArtistProfile =
    currentUser?.role === 'artist' && currentUser.id === (artist.artistId ?? artistId);
  const resolvedDisplayName =
    isOwnArtistProfile && currentUser?.username
      ? currentUser.username
      : artist.displayName;
  const resolvedBiography =
    isOwnArtistProfile && currentUser?.bio
      ? currentUser.bio
      : artist.biography;
  const resolvedProfileImageAssetId =
    isOwnArtistProfile && currentUser?.profileImageAssetId
      ? currentUser.profileImageAssetId
      : artist.profileImageAssetId;

  return (
    <div>
      <div className="artist-info-row">
        <div className="artist-avatar-lg">
          {resolvedProfileImageAssetId ? (
            <img src={getAssetUrl(resolvedProfileImageAssetId)} alt={`Foto de ${resolvedDisplayName}`} />
          ) : (
            resolvedDisplayName[0]?.toUpperCase()
          )}
        </div>
        <div className="artist-info-main">
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Artista</div>
          <div className="artist-name-lg">{resolvedDisplayName}</div>
          <div className="artist-stats">{resolvedBiography || 'Sin biografía publicada.'}</div>
        </div>
        {isOwnArtistProfile && (
          <Link className="artist-profile-edit-btn" to={routes.settings}>
            Editar
          </Link>
        )}
      </div>

      <div style={{ padding: '0 32px 40px' }}>
        <div className="section">
          <div className="section-title" style={{ marginBottom: 16 }}>Pistas publicadas</div>
          {tracks.length === 0 ? (
            <InlineState title="Sin pistas publicadas" />
          ) : (
            <table className="track-list">
              <thead><tr>
                <th style={{ width: 40 }}>#</th>
                <th>Título</th>
                <th>Género</th>
                <th className="track-duration-col">Duración</th>
              </tr></thead>
              <tbody>
                {tracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={{ ...track, artist: resolvedDisplayName }}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    onPlay={() => onPlayTrack({ ...track, artist: resolvedDisplayName })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">Discografía</div>
          </div>
          {albums.length === 0 ? (
            <InlineState title="Sin álbumes publicados" />
          ) : (
            <div className="album-grid">
              {albums.map(album => (
                <AlbumCard
                  key={album.albumId}
                  album={{ ...album, artist: resolvedDisplayName }}
                  onClick={() => navigate(routes.album(album.albumId))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const listenerTrackPropType = PropTypes.shape({
  albumId: PropTypes.string,
  albumTitle: PropTypes.string,
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
});

InlineState.propTypes = {
  message: PropTypes.string,
  title: PropTypes.string.isRequired,
};

HomePage.propTypes = {};

SearchPage.propTypes = {
  currentTrack: listenerTrackPropType,
  onPlayTrack: PropTypes.func.isRequired,
};

AlbumDetailPage.propTypes = {
  albumId: PropTypes.string,
  currentTrack: listenerTrackPropType,
  onPlayTrack: PropTypes.func.isRequired,
};

ArtistProfilePage.propTypes = {
  artistId: PropTypes.string,
  currentUser: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.string,
  }),
  currentTrack: listenerTrackPropType,
  onPlayTrack: PropTypes.func.isRequired,
};

