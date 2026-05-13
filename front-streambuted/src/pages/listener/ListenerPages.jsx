import { useEffect, useMemo, useState } from 'react';
import { IcMusic, IcSearch } from '../../components/icons/Icons';
import { AlbumCard } from '../../components/ui/AlbumCard';
import { TrackRow } from '../../components/ui/TrackRow';
import { catalogService } from '../../services/catalogService';
import { getAssetUrl } from '../../services/mediaService';
import { formatDate } from '../../utils/formatters';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo cargar la informacion.';
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
      } catch {
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
      } catch {
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
    albumTitle: track.albumId && albumTitlesById[track.albumId] ? albumTitlesById[track.albumId] : 'Single',
  }));
}

export function HomePage({ setPage }) {
  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Home</div>
        <div className="page-subtitle">
          Catalog, Identity y Media ya se consumen desde Gateway. Usa Search para consultar contenido real.
        </div>
      </div>

      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Catalogo conectado</div>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          Esta pantalla ya no muestra albums o canciones mock. Cuando el backend agregue endpoints de
          recomendaciones, home podra poblarse con datos productivos.
        </p>
        <button className="btn-primary" onClick={() => setPage('search')}>
          Buscar en Catalog
        </button>
      </div>
    </div>
  );
}

export function SearchPage({ onPlayTrack, currentTrack, setPage, setViewAlbum, setViewArtist }) {
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

    const timeoutId = window.setTimeout(async () => {
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
      window.clearTimeout(timeoutId);
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
            placeholder="Busca canciones, artistas, albums..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="page-inner" style={{ paddingTop: 24 }}>
        {!query.trim() && (
          <InlineState
            title="Busca en el catalogo real"
            message="La busqueda llama GET /api/v1/catalog/search por Gateway."
          />
        )}

        {isLoading && <InlineState title="Buscando..." message="Consultando Catalog Service." />}
        {error && <InlineState title="No se pudo buscar" message={error} />}
        {isEmpty && <InlineState title="Sin resultados" message="Catalog no devolvio artistas, albums ni pistas para esta busqueda." />}

        {results.artists.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">Artistas</div>
            </div>
            <div className="album-grid">
              {results.artists.map((artist) => (
                <div
                  key={artist.artistId}
                  className="album-card"
                  onClick={() => { setViewArtist(artist.artistId); setPage('artist-profile'); }}
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
                </div>
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
                <th>Titulo</th>
                <th>Genero</th>
                <th>Album</th>
                <th className="track-duration-col">Duracion</th>
              </tr></thead>
              <tbody>
                {results.tracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    onPlay={() => onPlayTrack(track)}
                    onArtistClick={artistId => { setViewArtist(artistId); setPage('artist-profile'); }}
                    metaText={track.genre || 'Sin genero'}
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
              <div className="section-title">Albums</div>
            </div>
            <div className="album-grid">
              {results.albums.map(album => (
                <AlbumCard
                  key={album.albumId}
                  album={album}
                  onClick={() => { setViewAlbum(album.albumId); setPage('album-detail'); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AlbumDetailPage({ albumId, onPlayTrack, currentTrack, setPage, setViewArtist }) {
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
    return <div className="page-inner"><InlineState title="Album no seleccionado" /></div>;
  }

  if (isLoading) {
    return <div className="page-inner"><InlineState title="Cargando album..." /></div>;
  }

  if (error) {
    return <div className="page-inner"><InlineState title="No se pudo cargar el album" message={error} /></div>;
  }

  if (!album) {
    return <div className="page-inner"><InlineState title="Album no encontrado" /></div>;
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
          <div className="album-hero-type">Album</div>
          <div className="album-hero-title">{album.title}</div>
          <div className="album-hero-meta">
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setViewArtist(album.artistId); setPage('artist-profile'); }}>
              {album.artist || 'Artista'}
            </span>
            <span className="dot-sep" />
            <span>{album.status}</span>
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
              <th>Titulo</th>
              <th>Genero</th>
              <th className="track-duration-col">Duracion</th>
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
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ArtistProfilePage({ artistId, onPlayTrack, currentTrack, setPage, setViewAlbum }) {
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

  return (
    <div>
      <div className="artist-banner">
        <div className="artist-banner-gradient" />
      </div>
      <div className="artist-info-row">
        <div className="artist-avatar-lg">
          {artist.profileImageAssetId ? (
            <img src={getAssetUrl(artist.profileImageAssetId)} alt={`Foto de ${artist.displayName}`} />
          ) : (
            artist.displayName[0]?.toUpperCase()
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Artista</div>
          <div className="artist-name-lg">{artist.displayName}</div>
          <div className="artist-stats">{artist.biography || 'Sin biografia publicada.'}</div>
        </div>
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
                <th>Titulo</th>
                <th>Genero</th>
                <th className="track-duration-col">Duracion</th>
              </tr></thead>
              <tbody>
                {tracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={{ ...track, artist: artist.displayName }}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    onPlay={() => onPlayTrack({ ...track, artist: artist.displayName })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">Discografia</div>
          </div>
          {albums.length === 0 ? (
            <InlineState title="Sin albums publicados" />
          ) : (
            <div className="album-grid">
              {albums.map(album => (
                <AlbumCard
                  key={album.albumId}
                  album={{ ...album, artist: artist.displayName }}
                  onClick={() => { setViewAlbum(album.albumId); setPage('album-detail'); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
