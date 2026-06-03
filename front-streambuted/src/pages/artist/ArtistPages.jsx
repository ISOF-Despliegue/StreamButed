import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IcMusic, IcPlay } from '../../components/icons/Icons';
import { TrackRow } from '../../components/ui/TrackRow';
import { FilePicker } from '../../components/ui/FilePicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { InlineState } from '../../components/ui/InlineState';
import { SearchInput } from '../../components/ui/SearchInput';
import { TEXT_LIMITS } from '../../constants/textLimits';
import { useSearchController } from '../../hooks/useSearchController';
import { analyticsService } from '../../services/analyticsService';
import { catalogService } from '../../services/catalogService';
import {
  getAssetUrl,
  getUploadFileHelperText,
  getUploadFileNameError,
  mediaService,
} from '../../services/mediaService';
import { emitLibraryRefreshRequested } from '../../services/libraryEvents';
import { routes } from '../../routes/appRoutes';
import { formatDate, formatNumber } from '../../utils/formatters';
import { includesSearchTerm } from '../../utils/searchText';
import { toUserFacingMessage } from '../../utils/userFacingMessages';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return 'No se pudo completar la solicitud.';
}

function getCatalogStatusLabel(status) {
  return status === 'RETIRADO' ? 'Retirado' : 'Publicado';
}

function getCatalogStatusColor(status) {
  return status === 'RETIRADO' ? 'var(--danger)' : 'var(--t2)';
}

function isCatalogRetired(item) {
  return item?.status === 'RETIRADO';
}

function isCatalogPublished(item) {
  return item?.status === 'PUBLICADO';
}

function getArtistPlayableTrack(track, username) {
  return {
    ...track,
    artist: track.artist ?? track.artistName ?? username ?? 'Artista',
  };
}

function formatMetricNumber(value) {
  return formatNumber(Number(value ?? 0));
}

const TRACK_GENRES = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Electrónica',
  'Regional',
  'Reguetón',
  'Jazz',
  'Clásica',
  'Indie',
  'Otro',
];

const TRACK_TITLE_MAX_LENGTH = TEXT_LIMITS.trackTitle;
const ALBUM_TITLE_MAX_LENGTH = TEXT_LIMITS.albumTitle;
const GENRE_MAX_LENGTH = TEXT_LIMITS.trackGenre;

const MAX_AUDIO_SIZE_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,video/mp4,.mp3,.wav,.flac,.ogg,.webm,.m4a,.mp4';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'video/mp4',
]);
const AUDIO_FILE_HELPER = `MP3, WAV, FLAC, OGG, WEBM, M4A o MP4 - máximo 200 MB. ${getUploadFileHelperText('mi-cancion-01.mp3')}`;
const IMAGE_FILE_HELPER = `JPG, PNG o WEBP - máximo 5 MB. ${getUploadFileHelperText('portada-01.png')}`;

function normalizeText(value) {
  return (value ?? '').trim();
}

function hasEmptyTrackFields({ title, genre, audioFile, coverFile }) {
  return !normalizeText(title) || !normalizeText(genre) || !audioFile || !coverFile;
}

function validateCoverImage(file) {
  if (!file) return 'Selecciona una portada.';
  const fileNameError = getUploadFileNameError(file, 'portada-01.png');
  if (fileNameError) return fileNameError;
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) return 'Formato de imagen inválido. Usa JPG, PNG o WEBP.';
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'La imagen supera el máximo de 5 MB.';
  return '';
}

function validateAudio(file) {
  if (!file) return 'Audio requerido.';
  const fileNameError = getUploadFileNameError(file, 'mi-cancion-01.mp3');
  if (fileNameError) return fileNameError;
  
  // Infer type from extension if file.type is empty
  let fileType = file.type;
  if (!fileType && file.name) {
    const ext = file.name.toLowerCase().split('.').pop();
    const extToMime = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
    };
    fileType = extToMime[ext] || '';
  }
  
  if (!fileType || !ALLOWED_AUDIO_TYPES.has(fileType)) {
    return 'Formato de audio inválido. Usa MP3, WAV, FLAC, OGG, WEBM, M4A o MP4.';
  }
  if (file.size > MAX_AUDIO_SIZE_BYTES) return 'El audio supera el máximo de 200 MB.';
  return '';
}

function buildFileChangeHandler({ validate, setFile, setError }) {
  return (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    const errorMessage = validate(selectedFile);
    if (errorMessage) {
      event.target.value = '';
      setFile(null);
      setError(errorMessage);
      return;
    }
    setError('');
    setFile(selectedFile);
  };
}

const artistUserPropType = PropTypes.shape({
  id: PropTypes.string,
  username: PropTypes.string,
});

const artistTrackPropType = PropTypes.shape({
  albumId: PropTypes.string,
  artist: PropTypes.string,
  artistId: PropTypes.string,
  artistName: PropTypes.string,
  audioAssetId: PropTypes.string,
  coverAssetId: PropTypes.string,
  createdAt: PropTypes.string,
  duration: PropTypes.number,
  durationSeconds: PropTypes.number,
  genre: PropTypes.string,
  id: PropTypes.string,
  status: PropTypes.string,
  title: PropTypes.string,
  trackId: PropTypes.string,
});

const artistAlbumPropType = PropTypes.shape({
  albumId: PropTypes.string,
  artist: PropTypes.string,
  artistId: PropTypes.string,
  coverAssetId: PropTypes.string,
  createdAt: PropTypes.string,
  status: PropTypes.string,
  title: PropTypes.string,
});

export function ArtistDashboardPage({ user, onPlayTrack, currentTrack }) {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setAnalyticsError('');

    try {
      const [trackResponse, albumResponse, artistAnalytics] = await Promise.all([
        catalogService.listManagedArtistTracks(user.id),
        catalogService.listManagedArtistAlbums(user.id),
        analyticsService.getArtistSummary(user.id).catch(err => {
          setAnalyticsError(getErrorMessage(err));
          return null;
        }),
      ]);
      setTracks(trackResponse);
      setAlbums(albumResponse);
      setAnalyticsSummary(artistAnalytics);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const publishedTracks = useMemo(
    () => tracks.filter(track => isCatalogPublished(track)),
    [tracks]
  );

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="artist-view-badge">Artista</div>
        <div className="page-title">Panel</div>
        <div className="page-subtitle">Bienvenido, {user.username}</div>
      </div>

      {isLoading && <InlineState title="Cargando tu música..." />}
      {error && (
        <InlineState
          title="Estamos preparando tu perfil de artista"
          message="Tu perfil estará listo en unos segundos. Intenta de nuevo en un momento."
          onRetry={loadCatalog}
        />
      )}

      {!isLoading && !error && (
        <>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-card-label">Pistas publicadas</div><div className="stat-card-value">{publishedTracks.length}</div></div>
            <div className="stat-card"><div className="stat-card-label">Álbumes</div><div className="stat-card-value">{albums.length}</div></div>
            <div className="stat-card"><div className="stat-card-label">Reproducciones</div><div className="stat-card-value">{formatMetricNumber(analyticsSummary?.totalPlays)}</div></div>
            <div className="stat-card">
              <div className="stat-card-label">Promedio diario</div>
              <div className="stat-card-value">{formatMetricNumber(analyticsSummary?.averageDailyPlays)}</div>
              <div className="stat-card-delta">{formatMetricNumber(analyticsSummary?.averageDailyUniqueListeners)} oyentes únicos</div>
            </div>
          </div>
          {analyticsError && (
            <div className="confirm-dialog-warning" style={{ marginBottom: 18 }}>
              Las estadísticas no están disponibles temporalmente: {analyticsError}
            </div>
          )}

          <div className="section">
            <div className="section-header">
              <div className="section-title">Mis pistas recientes</div>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate(routes.artistTracks)}>Ver todas</button>
            </div>
            {tracks.length === 0 ? (
              <InlineState title="Aún no tienes pistas" message="Sube una canción con su portada para empezar tu catálogo." />
            ) : (
              <table className="track-list">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Título</th><th>Género</th><th className="track-duration-col">Duración</th></tr></thead>
                <tbody>
                  {publishedTracks.slice(0, 10).map((track, index) => (
                    <TrackRow
                      key={track.trackId}
                      track={{ ...track, artist: user.username }}
                      index={index}
                      isPlaying={currentTrack?.trackId === track.trackId}
                      onPlay={() => onPlayTrack({ ...track, artist: user.username })}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {analyticsSummary?.topTracks?.length > 0 && (
            <div className="section">
              <div className="section-header">
                <div className="section-title">Canciones principales</div>
                <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate(routes.artistAnalytics)}>Ver analíticas</button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Canción</th><th>Reproducciones</th><th>Oyentes únicos</th></tr></thead>
                  <tbody>
                    {analyticsSummary.topTracks.map(track => (
                      <tr key={track.trackId}>
                        <td>{track.title}</td>
                        <td>{formatMetricNumber(track.plays)}</td>
                        <td>{formatMetricNumber(track.uniqueListeners)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

ArtistDashboardPage.propTypes = {
  currentTrack: artistTrackPropType,
  onPlayTrack: PropTypes.func.isRequired,
  user: artistUserPropType.isRequired,
};

export function MyTracksPage({ user, toast, currentTrack = null, onPlayTrack = undefined }) {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetiringTrack, setIsRetiringTrack] = useState(false);
  const [error, setError] = useState('');
  const [trackToRetire, setTrackToRetire] = useState(null);
  const [trackSearchTerm, setTrackSearchTerm] = useState('');

  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [trackResponse, albumResponse] = await Promise.all([
        catalogService.listManagedArtistTracks(user.id),
        catalogService.listManagedArtistAlbums(user.id),
      ]);
      setTracks(trackResponse);
      setAlbums(albumResponse);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  const albumTitleById = new Map(albums.map(album => [album.albumId, album.title]));
  const trackSearchController = useSearchController({
    onClear: useCallback(() => setTrackSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setTrackSearchTerm(searchTerm), []),
  });
  const filteredTracks = useMemo(() => {
    if (!trackSearchTerm) return tracks;
    return tracks.filter(track => (
      includesSearchTerm(track.title, trackSearchTerm) ||
      includesSearchTerm(track.genre, trackSearchTerm) ||
      includesSearchTerm(albumTitleById.get(track.albumId), trackSearchTerm)
    ));
  }, [albumTitleById, trackSearchTerm, tracks]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const retire = async () => {
    if (!trackToRetire?.trackId || isRetiringTrack) return;

    try {
      setIsRetiringTrack(true);
      await catalogService.deleteTrack(trackToRetire.trackId);
      emitLibraryRefreshRequested();
      toast('Pista eliminada.');
      setTrackToRetire(null);
      await loadTracks();
    } catch (err) {
      setTrackToRetire(null);
      toast(getErrorMessage(err));
    } finally {
      setIsRetiringTrack(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="my-tracks-header">
        <div className="page-title">Mis pistas</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => navigate(routes.artistAlbums)}>Álbumes</button>
          <button className="btn-ghost" onClick={() => navigate(routes.artistUpload)}>+ Subir pista</button>
          <button className="btn-primary" onClick={() => navigate(routes.artistAlbumNew)}>+ Crear álbum</button>
        </div>
      </div>

      {isLoading && <InlineState title="Cargando pistas..." />}
      {error && <InlineState title="No se pudieron cargar tus pistas" message={error} onRetry={loadTracks} />}

      {!isLoading && !error && (
        <div className="table-wrap">
          {tracks.length > 0 && (
            <div className="table-header">
              <SearchInput
                cooldownUntil={trackSearchController.cooldownUntil}
                placeholder="Buscar en mis pistas"
                value={trackSearchController.searchValue}
                onChange={trackSearchController.setSearchValue}
                onSubmit={trackSearchController.submitSearch}
              />
            </div>
          )}
          {tracks.length === 0 ? (
            <InlineState title="Sin pistas publicadas" />
          ) : filteredTracks.length === 0 ? (
            <InlineState title="Sin pistas para esta búsqueda" />
          ) : (
            <table className="data-table">
              <thead><tr><th>Título</th><th>Género</th><th>Álbum</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredTracks.map(track => (
                  <tr key={track.trackId}>
                    <td>
                      <button
                        className={`artist-track-play-button${currentTrack?.trackId === track.trackId ? ' active' : ''}`}
                        type="button"
                        onClick={() => onPlayTrack?.(getArtistPlayableTrack(track, user.username))}
                        aria-label={`Reproducir ${track.title}`}
                      >
                        <div className="track-thumb">
                          {track.coverAssetId ? (
                            <img src={getAssetUrl(track.coverAssetId)} alt={`Portada de ${track.title}`} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                          )}
                        </div>
                        <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{track.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>Pista publicada</div></div>
                        <span className="artist-play-inline" aria-hidden="true"><IcPlay /></span>
                      </button>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{track.genre || 'Sin género'}</td>
                    <td style={{ color: 'var(--t2)' }}>{track.albumId && albumTitleById.has(track.albumId) ? albumTitleById.get(track.albumId) : 'Sencillo'}</td>
                    <td style={{ color: getCatalogStatusColor(track.status) }}>{getCatalogStatusLabel(track.status)}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(track.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-ghost"
                          style={{ padding: '5px 12px', fontSize: 12 }}
                          onClick={() => navigate(routes.artistTrackEdit(track.trackId))}
                          disabled={isCatalogRetired(track)}
                          title={isCatalogRetired(track) ? 'No puedes editar una pista retirada.' : undefined}
                        >
                          Editar
                        </button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => setTrackToRetire(track)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(trackToRetire)}
        title="Eliminar pista"
        message={`Esta acción eliminará "${trackToRetire?.title ?? 'esta pista'}" de tu lista y dejará de estar disponible en la plataforma.`}
        confirmLabel="Eliminar pista"
        isLoading={isRetiringTrack}
        onConfirm={retire}
        onCancel={() => setTrackToRetire(null)}
      />
    </div>
  );
}

MyTracksPage.propTypes = {
  currentTrack: artistTrackPropType,
  onPlayTrack: PropTypes.func,
  toast: PropTypes.func.isRequired,
  user: artistUserPropType.isRequired,
};

export function MyAlbumsPage({ user, toast, currentTrack = null, onPlayTrack = undefined }) {
  void currentTrack;
  void onPlayTrack;
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetiringAlbum, setIsRetiringAlbum] = useState(false);
  const [error, setError] = useState('');
  const [albumToRetire, setAlbumToRetire] = useState(null);
  const [albumSearchTerm, setAlbumSearchTerm] = useState('');

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [albumResponse, trackResponse] = await Promise.all([
        catalogService.listManagedArtistAlbums(user.id),
        catalogService.listManagedArtistTracks(user.id),
      ]);
      setAlbums(albumResponse);
      setTracks(trackResponse);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const retire = async () => {
    if (!albumToRetire?.albumId || isRetiringAlbum) return;

    try {
      setIsRetiringAlbum(true);
      await catalogService.deleteAlbum(albumToRetire.albumId);
      emitLibraryRefreshRequested();
      toast('Álbum eliminado.');
      setAlbumToRetire(null);
      await loadAlbums();
    } catch (err) {
      setAlbumToRetire(null);
      toast(getErrorMessage(err));
    } finally {
      setIsRetiringAlbum(false);
    }
  };

  const addTrackToAlbum = (albumId) => {
    navigate(routes.artistUploadForAlbum(albumId));
  };

  const getAlbumTracks = (albumId) => tracks.filter(track => track.albumId === albumId);
  const countTracks = (albumId) => getAlbumTracks(albumId).filter(track => isCatalogPublished(track)).length;
  const albumSearchController = useSearchController({
    onClear: useCallback(() => setAlbumSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setAlbumSearchTerm(searchTerm), []),
  });
  const filteredAlbums = useMemo(() => {
    if (!albumSearchTerm) return albums;
    return albums.filter(album => includesSearchTerm(album.title, albumSearchTerm));
  }, [albumSearchTerm, albums]);

  return (
    <div className="page-inner">
      <div className="my-tracks-header">
        <div className="page-title">Mis álbumes</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => navigate(routes.artistTracks)}>Pistas</button>
          <button className="btn-primary" onClick={() => navigate(routes.artistAlbumNew)}>+ Crear álbum</button>
        </div>
      </div>

      {isLoading && <InlineState title="Cargando álbumes..." />}
      {error && <InlineState title="No se pudieron cargar tus álbumes" message={error} onRetry={loadAlbums} />}

      {!isLoading && !error && (
        <div className="table-wrap">
          {albums.length > 0 && (
            <div className="table-header">
              <SearchInput
                cooldownUntil={albumSearchController.cooldownUntil}
                placeholder="Buscar en mis álbumes"
                value={albumSearchController.searchValue}
                onChange={albumSearchController.setSearchValue}
                onSubmit={albumSearchController.submitSearch}
              />
            </div>
          )}
          {albums.length === 0 ? (
            <InlineState title="Sin álbumes publicados" message="Crea un álbum y luego agrega canciones desde esta misma vista." />
          ) : filteredAlbums.length === 0 ? (
            <InlineState title="Sin álbumes para esta búsqueda" />
          ) : (
            <table className="data-table">
              <thead><tr><th>Álbum</th><th>Pistas</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredAlbums.map(album => (
                  <tr key={album.albumId}>
                    <td>
                      <div className="artist-album-cell">
                        <button
                          className="artist-album-link"
                          type="button"
                          onClick={() => navigate(routes.album(album.albumId))}
                        >
                          <div className="track-thumb">
                            {album.coverAssetId ? (
                              <img src={getAssetUrl(album.coverAssetId)} alt={`Portada de ${album.title}`} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                            )}
                          </div>
                          <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{album.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>Álbum publicado</div></div>
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{countTracks(album.albumId)}</td>
                    <td style={{ color: getCatalogStatusColor(album.status) }}>{getCatalogStatusLabel(album.status)}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(album.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-ghost"
                          style={{ padding: '5px 12px', fontSize: 12 }}
                          onClick={() => addTrackToAlbum(album.albumId)}
                          disabled={isCatalogRetired(album)}
                          title={isCatalogRetired(album) ? 'No puedes agregar canciones a un álbum retirado.' : undefined}
                        >
                          Agregar canción
                        </button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => setAlbumToRetire(album)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(albumToRetire)}
        title="Eliminar álbum"
        message={`Esta acción eliminará "${albumToRetire?.title ?? 'este álbum'}" de tus álbumes y dejará de estar disponible en la plataforma.`}
        confirmLabel="Eliminar álbum"
        isLoading={isRetiringAlbum}
        onConfirm={retire}
        onCancel={() => setAlbumToRetire(null)}
      />
    </div>
  );
}

MyAlbumsPage.propTypes = {
  currentTrack: artistTrackPropType,
  onPlayTrack: PropTypes.func,
  toast: PropTypes.func.isRequired,
  user: artistUserPropType.isRequired,
};

export function UploadSinglePage({ user, toast, initialAlbumId = null, onUploadAlbumConsumed = undefined }) {
  const isAlbumLocked = Boolean(initialAlbumId);
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [albumId, setAlbumId] = useState(initialAlbumId ?? '');
  const [lockedAlbum, setLockedAlbum] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const availableAlbums = useMemo(() => albums.filter(album => !isCatalogRetired(album)), [albums]);
  const isLockedAlbumRetired = isCatalogRetired(lockedAlbum);

  useEffect(() => {
    setAlbumId(initialAlbumId ?? '');
  }, [initialAlbumId]);

  useEffect(() => {
    if (!initialAlbumId) {
      setLockedAlbum(null);
      return undefined;
    }

    const albumFromList = albums.find(album => album.albumId === initialAlbumId);
    if (albumFromList) {
      setLockedAlbum(albumFromList);
      return undefined;
    }

    let isMounted = true;
    catalogService
      .getAlbum(initialAlbumId)
      .then(album => {
        if (isMounted) setLockedAlbum(album);
      })
      .catch(() => {
        if (isMounted) setLockedAlbum(null);
      });

    return () => {
      isMounted = false;
    };
  }, [albums, initialAlbumId]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    catalogService
      .listManagedArtistAlbums(user.id)
      .then(albumResponse => {
        if (isMounted) setAlbums(albumResponse);
      })
      .catch(err => {
        if (isMounted) setError(getErrorMessage(err));
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!albumId) return;
    if (isAlbumLocked) return;
    if (availableAlbums.some(album => album.albumId === albumId)) return;
    setAlbumId('');
  }, [albumId, availableAlbums, isAlbumLocked]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setCoverPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [coverFile]);

  const handleAudioChange = buildFileChangeHandler({
    validate: validateAudio,
    setFile: setAudioFile,
    setError,
  });

  const handleCoverChange = buildFileChangeHandler({
    validate: validateCoverImage,
    setFile: setCoverFile,
    setError,
  });

  const handlePublish = async () => {
    const normalizedTitle = normalizeText(title);
    const normalizedGenre = normalizeText(genre);

    if (isLockedAlbumRetired) {
      return setError('No puedes agregar canciones a un álbum retirado.');
    }

    if (hasEmptyTrackFields({ title, genre, audioFile, coverFile })) {
      return setError('Todos los campos son obligatorios.');
    }
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título no puede superar 100 caracteres.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El género no puede superar 80 caracteres.');

    const audioError = validateAudio(audioFile);
    if (audioError) return setError(audioError);
    const coverError = validateCoverImage(coverFile);
    if (coverError) return setError(coverError);

    setError('');
    setIsSubmitting(true);

    try {
      const audio = await mediaService.uploadAudio(audioFile);
      const trackCover = await mediaService.uploadCatalogImage(coverFile, 'TRACK_COVER');
      const payload = {
        title: normalizedTitle,
        genre: normalizedGenre,
        audioAssetId: audio.assetId,
        coverAssetId: trackCover.assetId,
        durationSeconds: audio.durationSeconds ?? null,
      };

      if (albumId) {
        await catalogService.createTrackInAlbum(albumId, payload);
      } else {
        await catalogService.createTrack({
          albumId: null,
          ...payload,
        });
      }

      setTitle('');
      setGenre('');
      setAudioFile(null);
      setCoverFile(null);
      toast(albumId ? 'Canción agregada al álbum' : 'Pista publicada');
      if (!isAlbumLocked) {
        onUploadAlbumConsumed?.();
      }
    } catch (err) {
      setPendingAction(null);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">{isAlbumLocked ? 'Agregar canción al álbum' : 'Subir canción'}</div></div>

      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Audio</div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="upload-track-title">Título de la canción</label>
          <input
            id="upload-track-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Título de la canción"
            maxLength={TRACK_TITLE_MAX_LENGTH}
          />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="upload-track-genre">Género</label>
          <input
            id="upload-track-genre"
            list="track-genres"
            value={genre}
            onChange={event => setGenre(event.target.value)}
            placeholder="Rock, Pop, Electrónica..."
            maxLength={GENRE_MAX_LENGTH}
          />
          <datalist id="track-genres">
            {TRACK_GENRES.map(option => <option key={option} value={option} />)}
          </datalist>
        </div>
        {isAlbumLocked ? (
          <div className="form-group-mb">
            <div className="form-label">Álbum destino</div>
            <div style={{ fontSize: 14, color: 'var(--t1)' }}>
              {lockedAlbum?.title ?? 'Cargando álbum...'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              {isLockedAlbumRetired
                ? 'Este álbum está retirado y no acepta canciones nuevas.'
                : 'Esta canción se agregará directamente a este álbum.'}
            </div>
          </div>
        ) : (
          <div className="form-group-mb">
            <label className="form-label" htmlFor="upload-track-album">Álbum destino</label>
            <select id="upload-track-album" value={albumId} onChange={event => setAlbumId(event.target.value)}>
              <option value="">Publicar como single</option>
              {availableAlbums.map(album => (
                <option key={album.albumId} value={album.albumId}>{album.title}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              {availableAlbums.length ? 'Puedes publicarla como single o agregarla a un álbum disponible.' : 'Crea un álbum disponible para poder asociar canciones desde aquí.'}
            </div>
          </div>
        )}
        <div className="form-group-mb">
          <div className="form-label">Archivo de audio</div>
          <FilePicker
            accept={AUDIO_ACCEPT}
            file={audioFile}
            onChange={handleAudioChange}
            helperText={AUDIO_FILE_HELPER}
            buttonLabel="Seleccionar archivo"
          />
        </div>
        <div className="form-group-mb">
          <div className="form-label">Portada</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={coverFile}
            onChange={handleCoverChange}
            helperText={IMAGE_FILE_HELPER}
            buttonLabel="Seleccionar archivo"
          />
          {coverPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={coverPreviewUrl}
                alt="Previsualización de portada"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handlePublish} disabled={isSubmitting || isLockedAlbumRetired}>
          {isSubmitting ? 'Publicando...' : 'Publicar canción'}
        </button>
      </div>
    </div>
  );
}

UploadSinglePage.propTypes = {
  initialAlbumId: PropTypes.string,
  onUploadAlbumConsumed: PropTypes.func,
  toast: PropTypes.func.isRequired,
  user: artistUserPropType.isRequired,
};

function AddTrackToAlbumForm({ album, onTrackCreated, toast }) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isAlbumRetired = isCatalogRetired(album);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setCoverPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [coverFile]);

  const handleAudioChange = buildFileChangeHandler({
    validate: validateAudio,
    setFile: setAudioFile,
    setError,
  });

  const handleCoverChange = buildFileChangeHandler({
    validate: validateCoverImage,
    setFile: setCoverFile,
    setError,
  });

  const handleCreateTrack = async () => {
    if (isAlbumRetired) {
      return setError('No puedes agregar canciones a un álbum retirado.');
    }

    const normalizedTitle = normalizeText(title);
    const normalizedGenre = normalizeText(genre);

    if (hasEmptyTrackFields({ title, genre, audioFile, coverFile })) {
      return setError('Todos los campos son obligatorios.');
    }
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título de la canción no puede superar 100 caracteres.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El género no puede superar 80 caracteres.');

    const audioError = validateAudio(audioFile);
    if (audioError) return setError(audioError);
    const coverError = validateCoverImage(coverFile);
    if (coverError) return setError(coverError);

    setError('');
    setIsSubmitting(true);

    try {
      const audio = await mediaService.uploadAudio(audioFile);
      const trackCover = await mediaService.uploadCatalogImage(coverFile, 'TRACK_COVER');
      const createdTrack = await catalogService.createTrackInAlbum(album.albumId, {
        title: normalizedTitle,
        genre: normalizedGenre,
        audioAssetId: audio.assetId,
        coverAssetId: trackCover.assetId,
        durationSeconds: audio.durationSeconds ?? null,
      });

      setTitle('');
      setGenre('');
      setAudioFile(null);
      setCoverFile(null);
      onTrackCreated?.(createdTrack);
      toast('Canción agregada al álbum');
    } catch (err) {
      setPendingAction(null);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-card" style={{ maxWidth: 760 }}>
      <div className="settings-card-title">Agregar canción a {album.title}</div>
      {isAlbumRetired && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
          Este álbum está retirado y no acepta canciones nuevas.
        </div>
      )}
      <div className="form-group-mb">
        <label className="form-label" htmlFor="album-created-track-title">Título de la canción</label>
        <input
          id="album-created-track-title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Título de la canción"
          maxLength={TRACK_TITLE_MAX_LENGTH}
          disabled={isSubmitting || isAlbumRetired}
        />
      </div>
      <div className="form-group-mb">
        <label className="form-label" htmlFor="album-created-track-genre">Género</label>
        <input
          id="album-created-track-genre"
          list="track-genres"
          value={genre}
          onChange={event => setGenre(event.target.value)}
          placeholder="Rock, Pop, Electrónica..."
          maxLength={GENRE_MAX_LENGTH}
          disabled={isSubmitting || isAlbumRetired}
        />
      </div>
      <div className="form-group-mb">
        <div className="form-label">Archivo de audio</div>
        <FilePicker
          accept={AUDIO_ACCEPT}
          file={audioFile}
          onChange={handleAudioChange}
          helperText={AUDIO_FILE_HELPER}
          buttonLabel="Seleccionar archivo"
        />
      </div>
      <div className="form-group-mb">
        <div className="form-label">Portada de la canción</div>
        <FilePicker
          accept="image/png,image/jpeg,image/webp"
          file={coverFile}
          onChange={handleCoverChange}
          helperText={IMAGE_FILE_HELPER}
          buttonLabel="Seleccionar archivo"
        />
        {coverPreviewUrl && (
          <div style={{ marginTop: 10 }}>
            <img
              src={coverPreviewUrl}
              alt="Previsualización de portada de la canción"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </div>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      <button className="btn-primary" onClick={handleCreateTrack} disabled={isSubmitting || isAlbumRetired}>
        {isSubmitting ? 'Agregando...' : 'Agregar canción'}
      </button>
    </div>
  );
}

AddTrackToAlbumForm.propTypes = {
  album: artistAlbumPropType.isRequired,
  onTrackCreated: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
};

export function CreateAlbumPage({ toast }) {
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [createdAlbum, setCreatedAlbum] = useState(null);
  const [createdTracks, setCreatedTracks] = useState([]);
  const [isCreateAnotherOpen, setIsCreateAnotherOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCoverChange = buildFileChangeHandler({
    validate: validateCoverImage,
    setFile: setCoverFile,
    setError,
  });

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setCoverPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [coverFile]);

  const handleCreate = async () => {
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle || !coverFile) return setError('Todos los campos son obligatorios.');
    if (normalizedTitle.length > ALBUM_TITLE_MAX_LENGTH) return setError('El título no puede superar 100 caracteres.');
    const coverError = validateCoverImage(coverFile);
    if (coverError) return setError(coverError);

    setError('');
    setIsSubmitting(true);

    try {
      const albumCover = await mediaService.uploadCatalogImage(coverFile, 'ALBUM_COVER');
      const album = await catalogService.createAlbum({
        title: normalizedTitle,
        coverAssetId: albumCover.assetId,
      });

      setTitle('');
      setCoverFile(null);
      setCreatedAlbum(album);
      setCreatedTracks([]);
      toast('Álbum creado');
    } catch (err) {
      setPendingAction(null);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForAnotherAlbum = () => {
    setTitle('');
    setCoverFile(null);
    setCreatedAlbum(null);
    setCreatedTracks([]);
    setError('');
    setIsCreateAnotherOpen(false);
  };

  const closeCreateAnotherIfFocusLeaves = (event) => {
    const action = event.currentTarget.parentElement;
    const nextFocusTarget = event.relatedTarget;

    if (!action || !nextFocusTarget || !action.contains(nextFocusTarget)) {
      setIsCreateAnotherOpen(false);
    }
  };

  if (createdAlbum) {
    return (
      <div className="page-inner">
        <div className="page-header album-created-header">
          <div>
            <div className="page-title">Agregar canciones</div>
            <div className="page-subtitle">Álbum: {createdAlbum.title}</div>
          </div>
          <div
            aria-label="Crear otro álbum"
            className={`create-another-album-action${isCreateAnotherOpen ? ' is-open' : ''}`}
            role="group"
          >
            <button
              className="btn-icon create-another-album-plus"
              type="button"
              aria-label="Mostrar crear otro álbum"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setIsCreateAnotherOpen(true)}
              onFocus={() => setIsCreateAnotherOpen(true)}
              onBlur={closeCreateAnotherIfFocusLeaves}
              onClick={() => setIsCreateAnotherOpen(true)}
            >
              +
            </button>
            {isCreateAnotherOpen && (
              <button
                className="btn-ghost create-another-album-label"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onBlur={closeCreateAnotherIfFocusLeaves}
                onClick={resetForAnotherAlbum}
              >
                Crear otro álbum
              </button>
            )}
          </div>
        </div>

        <div
          className="confirm-dialog-warning"
          style={{
            color: 'var(--success)',
            borderColor: 'rgba(34,197,94,0.35)',
            background: 'rgba(34,197,94,0.08)',
            marginBottom: 18,
            maxWidth: 760,
          }}
        >
          Álbum "{createdAlbum.title}" creado. Ahora puedes agregar canciones con portada propia.
        </div>

        <AddTrackToAlbumForm
          album={createdAlbum}
          toast={toast}
          onTrackCreated={(track) => {
            setCreatedTracks((currentTracks) => [track, ...currentTracks]);
          }}
        />
        <div className="settings-card" style={{ maxWidth: 760 }}>
          <div className="settings-card-title">Canciones agregadas</div>
          {createdTracks.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--t2)' }}>
              Aún no has agregado canciones a este álbum.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {createdTracks.map(track => (
                <div
                  key={track.trackId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: 'var(--t2)',
                    fontSize: 13,
                  }}
                >
                  <div className="track-thumb">
                    {track.coverAssetId ? (
                      <img
                        src={getAssetUrl(track.coverAssetId)}
                        alt={`Portada de ${track.title}`}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--t3)',
                        }}
                      >
                        <IcMusic />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'var(--t1)', fontWeight: 600 }}>{track.title}</div>
                    <div>{track.genre}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">Crear álbum</div></div>
      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Información del álbum</div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="create-album-title">Título del álbum</label>
          <input
            id="create-album-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Título del álbum"
            maxLength={ALBUM_TITLE_MAX_LENGTH}
          />
        </div>
        <div className="form-group-mb">
          <div className="form-label">Portada</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={coverFile}
            onChange={handleCoverChange}
            helperText={IMAGE_FILE_HELPER}
            buttonLabel="Seleccionar archivo"
          />
          {coverPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={coverPreviewUrl}
                alt="Previsualización de portada del álbum"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Publicar álbum'}
        </button>
      </div>

    </div>
  );
}

CreateAlbumPage.propTypes = {
  toast: PropTypes.func.isRequired,
};

export function EditTrackPage({ track, user, onCancel, onDone, toast }) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [genre, setGenre] = useState(track?.genre ?? '');
  const [albumId, setAlbumId] = useState(track?.albumId ?? '');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [albums, setAlbums] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const availableAlbums = useMemo(() => albums.filter(album => !isCatalogRetired(album)), [albums]);
  const isTrackRetired = isCatalogRetired(track);

  useEffect(() => {
    setTitle(track?.title ?? '');
    setGenre(track?.genre ?? '');
    setAlbumId(track?.albumId ?? '');
    setCoverFile(null);
  }, [track]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setCoverPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [coverFile]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    catalogService
      .listManagedArtistAlbums(user.id)
      .then(albumResponse => {
        if (isMounted) setAlbums(albumResponse);
      })
      .catch(err => {
        if (isMounted) setError(getErrorMessage(err));
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!albumId) return;
    if (availableAlbums.some(album => album.albumId === albumId)) return;
    if (track?.albumId === albumId) {
      setAlbumId('');
    }
  }, [albumId, availableAlbums, track?.albumId]);

  if (!track?.trackId) {
    return (
      <div className="page-inner">
        <InlineState title="Selecciona una pista real para editar" />
      </div>
    );
  }

  const validateTrackChanges = () => {
    const normalizedTitle = normalizeText(title);
    const normalizedGenre = normalizeText(genre);

    if (!normalizedTitle || !normalizedGenre) return setError('Todos los campos son obligatorios.');
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título no puede superar 100 caracteres.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El género no puede superar 80 caracteres.');
    if (albumId && !availableAlbums.some(album => album.albumId === albumId)) {
      return setError('No puedes asociar la pista a un álbum retirado.');
    }

    return {
      title: normalizedTitle,
      genre: normalizedGenre,
      albumId: albumId || null,
    };
  };

  const requestSave = () => {
    if (isTrackRetired) {
      setError('No puedes editar una pista retirada.');
      return;
    }

    const payload = validateTrackChanges();
    if (!payload) return;

    setError('');
    setPendingAction({ type: 'save', payload });
  };

  const save = async () => {
    const payload = pendingAction?.payload ?? validateTrackChanges();
    if (!payload) return;

    setError('');
    setIsSubmitting(true);

    try {
      let updatePayload = payload;

      if (coverFile) {
        const coverError = validateCoverImage(coverFile);
        if (coverError) {
          setError(coverError);
          return;
        }
        const trackCover = await mediaService.uploadCatalogImage(coverFile, 'TRACK_COVER');
        updatePayload = {
          ...payload,
          coverAssetId: trackCover.assetId,
        };
      }

      await catalogService.updateTrack(track.trackId, updatePayload);
      toast('Cambios guardados');
      setPendingAction(null);
      setCoverFile(null);
      onDone();
    } catch (err) {
      setPendingAction(null);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const retire = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await catalogService.deleteTrack(track.trackId);
      emitLibraryRefreshRequested();
      toast('Pista eliminada.');
      setPendingAction(null);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCoverChange = buildFileChangeHandler({
    validate: validateCoverImage,
    setFile: setCoverFile,
    setError,
  });

  return (
      <div className="page-inner">
        <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={onCancel} type="button">
          Mis pistas
        </button>
        <span>/</span><span>Editar pista</span>
      </div>
      <div className="page-header"><div className="page-title">Editar pista</div></div>
      <div className="settings-card" style={{ maxWidth: 700 }}>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-title">Título</label>
          <input id="edit-track-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={TRACK_TITLE_MAX_LENGTH} />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-genre">Género</label>
          <input id="edit-track-genre" list="edit-track-genres" value={genre} onChange={event => setGenre(event.target.value)} maxLength={GENRE_MAX_LENGTH} />
          <datalist id="edit-track-genres">
            {TRACK_GENRES.map(option => <option key={option} value={option} />)}
          </datalist>
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-album">Álbum</label>
          <select id="edit-track-album" value={albumId} onChange={event => setAlbumId(event.target.value)}>
            <option value="">Sencillo / sin álbum</option>
            {availableAlbums.map(album => (
              <option key={album.albumId} value={album.albumId}>{album.title}</option>
            ))}
          </select>
        </div>
        <div className="form-group-mb">
          <div className="form-label">Portada</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={coverFile}
            onChange={handleCoverChange}
            helperText={IMAGE_FILE_HELPER}
            buttonLabel="Seleccionar portada"
          />
          <div style={{ marginTop: 10 }}>
            {coverPreviewUrl ? (
              <img
                src={coverPreviewUrl}
                alt="Previsualización de nueva portada"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            ) : track.coverAssetId ? (
              <img
                src={getAssetUrl(track.coverAssetId)}
                alt={`Portada actual de ${track.title}`}
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            ) : null}
          </div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn-danger" onClick={() => setPendingAction({ type: 'delete' })} disabled={isSubmitting}>Eliminar pista</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={requestSave}
              disabled={isSubmitting || isTrackRetired}
              title={isTrackRetired ? 'No puedes editar una pista retirada.' : undefined}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={pendingAction?.type === 'save'}
        title="Guardar cambios"
        message={`Confirma que deseas actualizar la información de "${track.title}".`}
        confirmLabel="Guardar cambios"
        tone="primary"
        isLoading={isSubmitting}
        onConfirm={save}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction?.type === 'delete'}
        title="Eliminar pista"
        message={`Esta acción eliminará "${track.title}" de tu lista y dejará de estar disponible en la plataforma.`}
        confirmLabel="Eliminar pista"
        isLoading={isSubmitting}
        onConfirm={retire}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

EditTrackPage.propTypes = {
  onCancel: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
  track: artistTrackPropType.isRequired,
  user: artistUserPropType.isRequired,
};

export function ArtistAnalyticsPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [breakdownSearchTerm, setBreakdownSearchTerm] = useState('');

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await analyticsService.getArtistSummary(user.id);
      setSummary(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const breakdownSearchController = useSearchController({
    onClear: useCallback(() => setBreakdownSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setBreakdownSearchTerm(searchTerm), []),
  });
  const filteredBreakdownTracks = useMemo(() => {
    const tracks = summary?.tracks ?? [];
    if (!breakdownSearchTerm) return tracks;
    return tracks.filter(track => includesSearchTerm(track.title, breakdownSearchTerm));
  }, [breakdownSearchTerm, summary]);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="artist-view-badge">Artista</div>
        <div className="page-title">Analíticas</div>
        <div className="page-subtitle">Rendimiento de tus canciones publicadas.</div>
      </div>

      {isLoading && <InlineState title="Cargando analíticas..." />}
      {error && <InlineState title="No se pudieron cargar las analíticas" message={error} onRetry={loadAnalytics} />}

      {!isLoading && !error && summary && (
        <>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-card-label">Reproducciones totales</div>
              <div className="stat-card-value">{formatMetricNumber(summary.totalPlays)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Promedio diario</div>
              <div className="stat-card-value">{formatMetricNumber(summary.averageDailyPlays)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Oyentes únicos al día</div>
              <div className="stat-card-value">{formatMetricNumber(summary.averageDailyUniqueListeners)}</div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <div className="section-title">Canciones principales</div>
            </div>
            {summary.topTracks.length === 0 ? (
              <InlineState title="Aún no hay reproducciones registradas" />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Canción</th><th>Reproducciones</th><th>Oyentes únicos</th></tr></thead>
                  <tbody>
                    {summary.topTracks.map(track => (
                      <tr key={track.trackId}>
                        <td>{track.title}</td>
                        <td>{formatMetricNumber(track.plays)}</td>
                        <td>{formatMetricNumber(track.uniqueListeners)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <div className="section-title">Desglose por canción</div>
            </div>
            {summary.tracks.length === 0 ? (
              <InlineState title="Sin canciones con métricas" />
            ) : (
              <div className="table-wrap">
                <div className="table-header">
                  <SearchInput
                    cooldownUntil={breakdownSearchController.cooldownUntil}
                    placeholder="Buscar canción en el desglose"
                    value={breakdownSearchController.searchValue}
                    onChange={breakdownSearchController.setSearchValue}
                    onSubmit={breakdownSearchController.submitSearch}
                    wrapperClassName="search-input-wrap-wide"
                  />
                </div>
                {filteredBreakdownTracks.length === 0 ? (
                  <InlineState title="Sin canciones para esta búsqueda" />
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Canción</th><th>Reproducciones</th><th>Oyentes únicos</th></tr></thead>
                    <tbody>
                      {filteredBreakdownTracks.map(track => (
                        <tr key={track.trackId}>
                          <td>{track.title}</td>
                          <td>{formatMetricNumber(track.plays)}</td>
                          <td>{formatMetricNumber(track.uniqueListeners)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

ArtistAnalyticsPage.propTypes = {
  user: artistUserPropType.isRequired,
};


