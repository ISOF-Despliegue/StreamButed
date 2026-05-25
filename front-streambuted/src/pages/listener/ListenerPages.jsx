import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IcMusic } from '../../components/icons/Icons';
import { AlbumCard } from '../../components/ui/AlbumCard';
import { SearchInput } from '../../components/ui/SearchInput';
import { TrackRow } from '../../components/ui/TrackRow';
import { useSearchController } from '../../hooks/useSearchController';
import { analyticsService } from '../../services/analyticsService';
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

function sortByNewest(items) {
  return [...items].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

function hasGenericArtistName(artistName) {
  return !artistName || artistName === 'Unknown artist' || artistName === 'Artista';
}

async function resolveDiscoverySummary(summary) {
  const [topAlbums, topArtists] = await Promise.all([
    Promise.all(
      (summary.topAlbums ?? [])
        .filter(album => Boolean(album.albumId))
        .map(async (albumMetric) => {
          let resolvedAlbum = {
            ...albumMetric,
            artistName: albumMetric.artistName ?? 'Artista',
            plays: Number(albumMetric.plays ?? 0),
          };

          if (!resolvedAlbum.coverAssetId || !resolvedAlbum.title || resolvedAlbum.title === 'Unknown album') {
            try {
              const catalogAlbum = await catalogService.getAlbum(albumMetric.albumId);
              resolvedAlbum = {
                ...resolvedAlbum,
                artistId: resolvedAlbum.artistId || catalogAlbum.artistId,
                coverAssetId: resolvedAlbum.coverAssetId ?? catalogAlbum.coverAssetId,
                title:
                  !resolvedAlbum.title || resolvedAlbum.title === 'Unknown album'
                    ? catalogAlbum.title
                    : resolvedAlbum.title,
              };
            } catch (error) {
              browserLogger.warn(`Failed to load fallback album ${albumMetric.albumId} for discovery summary.`, error);
            }
          }

          if (hasGenericArtistName(resolvedAlbum.artistName) && resolvedAlbum.artistId) {
            try {
              const catalogArtist = await catalogService.getArtist(resolvedAlbum.artistId);
              resolvedAlbum = {
                ...resolvedAlbum,
                artistName: catalogArtist.displayName,
              };
            } catch (error) {
              browserLogger.warn(`Failed to load fallback artist ${resolvedAlbum.artistId} for album discovery summary.`, error);
            }
          }

          return resolvedAlbum;
        })
    ),
    Promise.all(
      (summary.topArtists ?? [])
        .filter(artist => Boolean(artist.artistId))
        .map(async (artistMetric) => {
          let resolvedArtist = {
            ...artistMetric,
            artistName: artistMetric.artistName ?? 'Artista',
            plays: Number(artistMetric.plays ?? 0),
            profileImageAssetId: null,
          };

          try {
            const catalogArtist = await catalogService.getArtist(artistMetric.artistId);
            resolvedArtist = {
              ...resolvedArtist,
              artistName: catalogArtist.displayName || resolvedArtist.artistName,
              profileImageAssetId: catalogArtist.profileImageAssetId ?? null,
            };
          } catch (error) {
            browserLogger.warn(`Failed to load fallback artist ${artistMetric.artistId} for discovery summary.`, error);
          }

          return resolvedArtist;
        })
    ),
  ]);

  return { topAlbums, topArtists };
}

export function HomePage() {
  const navigate = useNavigate();
  const [discoverySummary, setDiscoverySummary] = useState({ topAlbums: [], topArtists: [] });
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState('');

  useEffect(() => {
    let mounted = true;
    setIsDiscoveryLoading(true);
    setDiscoveryError('');

    analyticsService
      .getDiscoverySummary()
      .then(resolveDiscoverySummary)
      .then(summary => {
        if (mounted) setDiscoverySummary(summary);
      })
      .catch(error => {
        if (mounted) setDiscoveryError(getErrorMessage(error));
      })
      .finally(() => {
        if (mounted) setIsDiscoveryLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Inicio</div>
        <div className="page-subtitle">
          Explora música, artistas y álbumes publicados en StreamButed.
        </div>
      </div>

      {(isDiscoveryLoading || discoveryError || discoverySummary.topAlbums.length > 0 || discoverySummary.topArtists.length > 0) && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">Escucha los álbumes más reproducidos</div>
          </div>
          {isDiscoveryLoading && <InlineState title="Cargando rankings..." />}
          {discoveryError && <InlineState title="No se pudieron cargar los rankings" message={discoveryError} />}
          {!isDiscoveryLoading && !discoveryError && discoverySummary.topAlbums.length > 0 && (
            <div className="album-grid">
              {discoverySummary.topAlbums.map(album => (
                <AlbumCard
                  key={album.albumId}
                  album={{
                    albumId: album.albumId,
                    artistId: album.artistId,
                    title: album.title,
                    artist: album.artistName ?? 'Artista',
                    coverAssetId: album.coverAssetId ?? null,
                  }}
                  onClick={() => navigate(routes.album(album.albumId))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isDiscoveryLoading && !discoveryError && discoverySummary.topArtists.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">Visita los artistas más escuchados</div>
          </div>
          <div className="album-grid">
            {discoverySummary.topArtists.map(artist => (
              <button
                key={artist.artistId}
                className="album-card"
                onClick={() => navigate(routes.artistProfile(artist.artistId))}
                type="button"
              >
                <div className="album-thumb">
                  {artist.profileImageAssetId ? (
                    <img src={getAssetUrl(artist.profileImageAssetId)} alt={`Foto de ${artist.artistName}`} />
                  ) : (
                    <div style={{ fontSize: 28, color: 'var(--t3)' }}><IcMusic /></div>
                  )}
                </div>
                <div className="album-card-title">{artist.artistName || 'Artista'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">¿Buscas algo en específico?</div>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          Busca canciones, visita perfiles de artistas y reproduce álbumes completos desde un solo lugar.
        </p>
        <Link
          className="btn-primary"
          to={routes.search}
          style={{ textDecoration: 'none' }}
        >
          Buscar música
        </Link>
      </div>
    </div>
  );
}

export function SearchPage({ onPlayTrack, currentTrack }) {
  const navigate = useNavigate();
  const [results, setResults] = useState({ artists: [], albums: [], tracks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearSearch = useCallback(() => {
    setResults({ artists: [], albums: [], tracks: [] });
    setError('');
    setHasSearched(false);
    setIsLoading(false);
  }, []);

  const runSearch = useCallback(async (searchTerm) => {
    setIsLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const response = await catalogService.searchCatalog({
        searchTerm,
        limit: 20,
        offset: 0,
      });
      const artistNamesById = await getArtistNamesById([
        ...(response.albums ?? []),
        ...(response.tracks ?? []),
      ]);
      if (!isMountedRef.current) return;
      const albums = withArtistNames(response.albums ?? [], artistNamesById);
      const albumTitlesById = await getAlbumTitlesById(response.tracks ?? [], albums);
      if (!isMountedRef.current) return;
      const tracks = withAlbumContext(withArtistNames(response.tracks ?? [], artistNamesById), albumTitlesById);

      if (!isMountedRef.current) return;
      setResults({
        artists: response.artists ?? [],
        albums,
        tracks,
      });
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const searchController = useSearchController({
    onClear: clearSearch,
    onSearch: runSearch,
  });

  const isEmpty = useMemo(
    () => hasSearched && !isLoading && !error && !results.artists.length && !results.albums.length && !results.tracks.length,
    [error, hasSearched, isLoading, results]
  );

  return (
    <div>
      <div className="search-header">
        <SearchInput
          cooldownUntil={searchController.cooldownUntil}
          placeholder="Busca canciones, artistas, álbumes..."
          value={searchController.searchValue}
          onChange={searchController.setSearchValue}
          onSubmit={searchController.submitSearch}
        />
      </div>
      <div className="page-inner" style={{ paddingTop: 24 }}>
        {!searchController.normalizedSearchTerm && (
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
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
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
      analyticsService.getArtistPublicSummary(artistId).catch(err => {
        browserLogger.warn(`Failed to load public artist analytics for ${artistId}.`, err);
        return null;
      }),
    ])
      .then(([artistResponse, trackResponse, albumResponse, analyticsResponse]) => {
        if (!mounted) return;
        setArtist(artistResponse);
        setTracks(trackResponse);
        setAlbums(albumResponse);
        setAnalyticsSummary(analyticsResponse);
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
  const tracksById = new Map(tracks.map(track => [track.trackId, track]));
  const topTracks = (analyticsSummary?.topTracks ?? [])
    .map(metric => {
      const track = tracksById.get(metric.trackId);
      return track ? { ...track, plays: metric.plays } : null;
    })
    .filter(Boolean)
    .slice(0, 10);
  const recentAlbums = sortByNewest(albums).slice(0, 10);
  const singleCount = tracks.filter(track => !track.albumId).length;
  const hasFullDiscography = albums.length > 0 || singleCount > 0;

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
          <div className="section-title" style={{ marginBottom: 16 }}>Canciones principales</div>
          {topTracks.length === 0 ? (
            <InlineState title="Sin canciones principales" />
          ) : (
            <table className="track-list">
              <thead><tr>
                <th style={{ width: 40 }}>#</th>
                <th>Título</th>
                <th>Género</th>
                <th className="track-duration-col">Duración</th>
              </tr></thead>
              <tbody>
                {topTracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={{ ...track, artist: resolvedDisplayName }}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    metaText={track.genre || 'Sin género'}
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
            {hasFullDiscography && (
              <button
                className="see-all-btn"
                type="button"
                onClick={() => navigate(routes.artistDiscography(artist.artistId ?? artistId))}
              >
                Ver todo
              </button>
            )}
          </div>
          {recentAlbums.length === 0 ? (
            <InlineState title="Sin álbumes publicados" />
          ) : (
            <div className="album-grid">
              {recentAlbums.map(album => (
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

export function ArtistDiscographyPage({ artistId, currentUser, onPlayTrack, currentTrack }) {
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
    return <div className="page-inner"><InlineState title="Cargando discografía..." /></div>;
  }

  if (error) {
    return <div className="page-inner"><InlineState title="No se pudo cargar la discografía" message={error} /></div>;
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
  const sortedAlbums = sortByNewest(albums);
  const singles = sortByNewest(tracks.filter(track => !track.albumId));

  return (
    <div className="page-inner">
      <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => navigate(routes.artistProfile(artist.artistId ?? artistId))} type="button">
          {resolvedDisplayName}
        </button>
        <span>/</span><span>Discografía</span>
      </div>
      <div className="page-header">
        <div className="page-title">Discografía de {resolvedDisplayName}</div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 16 }}>Álbumes</div>
        {sortedAlbums.length === 0 ? (
          <InlineState title="Sin álbumes publicados" />
        ) : (
          <div className="album-grid">
            {sortedAlbums.map(album => (
              <AlbumCard
                key={album.albumId}
                album={{ ...album, artist: resolvedDisplayName }}
                onClick={() => navigate(routes.album(album.albumId))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 16 }}>Singles</div>
        {singles.length === 0 ? (
          <InlineState title="Sin singles publicados" />
        ) : (
          <table className="track-list">
            <thead><tr>
              <th style={{ width: 40 }}>#</th>
              <th>Título</th>
              <th>Género</th>
              <th className="track-duration-col">Duración</th>
            </tr></thead>
            <tbody>
              {singles.map((track, index) => (
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
    bio: PropTypes.string,
    id: PropTypes.string,
    profileImageAssetId: PropTypes.string,
    role: PropTypes.string,
    username: PropTypes.string,
  }),
  currentTrack: listenerTrackPropType,
  onPlayTrack: PropTypes.func.isRequired,
};

ArtistDiscographyPage.propTypes = ArtistProfilePage.propTypes;

