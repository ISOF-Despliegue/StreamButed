import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IcMusic, IcPlay } from '../../components/icons/Icons';
import { TrackRow } from '../../components/ui/TrackRow';
import { FilePicker } from '../../components/ui/FilePicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { InlineState } from '../../components/ui/InlineState';
import { analyticsService } from '../../services/analyticsService';
import { catalogService } from '../../services/catalogService';
import {
  getAssetUrl,
  getUploadFileHelperText,
  getUploadFileNameError,
  mediaService,
} from '../../services/mediaService';
import { routes } from '../../routes/appRoutes';
import { formatDate } from '../../utils/formatters';
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

function getArtistPlayableTrack(track, username) {
  return {
    ...track,
    artist: track.artist ?? track.artistName ?? username ?? 'Artista',
  };
}

function formatMetricNumber(value) {
  return new Intl.NumberFormat('es-MX').format(Number(value ?? 0));
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

const TRACK_TITLE_MAX_LENGTH = 220;
const ALBUM_TITLE_MAX_LENGTH = 220;
const GENRE_MAX_LENGTH = 80;

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
        catalogService.listArtistTracks(user.id),
        catalogService.listArtistAlbums(user.id),
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
            <div className="stat-card"><div className="stat-card-label">Pistas publicadas</div><div className="stat-card-value">{tracks.length}</div></div>
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
                  {tracks.slice(0, 6).map((track, index) => (
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

  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [trackResponse, albumResponse] = await Promise.all([
        catalogService.listArtistTracks(user.id),
        catalogService.listArtistAlbums(user.id),
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

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const retire = async () => {
    if (!trackToRetire?.trackId || isRetiringTrack) return;

    try {
      setIsRetiringTrack(true);
      await catalogService.retireTrack(trackToRetire.trackId);
      toast('Pista retirada');
      setTrackToRetire(null);
      await loadTracks();
    } catch (err) {
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
          {tracks.length === 0 ? (
            <InlineState title="Sin pistas publicadas" />
          ) : (
            <table className="data-table">
              <thead><tr><th>Título</th><th>Género</th><th>Álbum</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {tracks.map(track => (
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
                    <td style={{ color: 'var(--t2)' }}>{getCatalogStatusLabel(track.status)}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(track.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => navigate(routes.artistTrackEdit(track.trackId))}>Editar</button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => setTrackToRetire(track)}>Retirar</button>
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
        title="Retirar pista"
        message={`Esta acción retirará "${trackToRetire?.title ?? 'esta pista'}". Los oyentes ya no podrán reproducirla desde la app.`}
        confirmLabel="Retirar pista"
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
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetiringAlbum, setIsRetiringAlbum] = useState(false);
  const [error, setError] = useState('');
  const [albumToRetire, setAlbumToRetire] = useState(null);

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [albumResponse, trackResponse] = await Promise.all([
        catalogService.listArtistAlbums(user.id),
        catalogService.listArtistTracks(user.id),
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
      await catalogService.retireAlbum(albumToRetire.albumId);
      toast('Álbum retirado');
      setAlbumToRetire(null);
      await loadAlbums();
    } catch (err) {
      toast(getErrorMessage(err));
    } finally {
      setIsRetiringAlbum(false);
    }
  };

  const addTrackToAlbum = (albumId) => {
    navigate(routes.artistUploadForAlbum(albumId));
  };

  const getAlbumTracks = (albumId) => tracks.filter(track => track.albumId === albumId);
  const countTracks = (albumId) => getAlbumTracks(albumId).length;
  const playAlbumTrack = (album, track) => {
    const albumTracks = getAlbumTracks(album.albumId).map(item => getArtistPlayableTrack(item, user.username));
    onPlayTrack?.(
      getArtistPlayableTrack(track, user.username),
      albumTracks,
      album.albumId
    );
  };

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
          {albums.length === 0 ? (
            <InlineState title="Sin álbumes publicados" message="Crea un álbum y luego agrega canciones desde esta misma vista." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Álbum</th><th>Pistas</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {albums.map(album => {
                  const albumTracks = getAlbumTracks(album.albumId);
                  const firstAlbumTrack = albumTracks[0];

                  return (
                  <tr key={album.albumId}>
                    <td>
                      <div className="artist-album-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="track-thumb">
                            {album.coverAssetId ? (
                              <img src={getAssetUrl(album.coverAssetId)} alt={`Portada de ${album.title}`} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                            )}
                          </div>
                          <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{album.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>Álbum publicado</div></div>
                        </div>
                        {albumTracks.length > 0 && (
                          <div className="artist-album-track-list" aria-label={`Pistas de ${album.title}`}>
                            {albumTracks.map(track => (
                              <button
                                className={`artist-album-track-chip${currentTrack?.trackId === track.trackId ? ' active' : ''}`}
                                key={track.trackId}
                                type="button"
                                onClick={() => playAlbumTrack(album, track)}
                                aria-label={`Reproducir ${track.title}`}
                              >
                                <IcPlay />
                                <span>{track.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{countTracks(album.albumId)}</td>
                    <td style={{ color: 'var(--t2)' }}>{getCatalogStatusLabel(album.status)}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(album.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-ghost"
                          disabled={!firstAlbumTrack}
                          style={{ padding: '5px 12px', fontSize: 12 }}
                          onClick={() => firstAlbumTrack && playAlbumTrack(album, firstAlbumTrack)}
                        >
                          Reproducir
                        </button>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => addTrackToAlbum(album.albumId)}>Agregar canción</button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => setAlbumToRetire(album)}>Retirar</button>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(albumToRetire)}
        title="Retirar álbum"
        message={`Esta acción retirará "${albumToRetire?.title ?? 'este álbum'}" y afectará su disponibilidad para los oyentes.`}
        confirmLabel="Retirar álbum"
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
      .listArtistAlbums(user.id)
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

    if (hasEmptyTrackFields({ title, genre, audioFile, coverFile })) {
      return setError('Todos los campos son obligatorios.');
    }
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título no puede superar 220 caracteres.');
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
              Esta canción se agregará directamente a este álbum.
            </div>
          </div>
        ) : (
          <div className="form-group-mb">
            <label className="form-label" htmlFor="upload-track-album">Álbum destino</label>
            <select id="upload-track-album" value={albumId} onChange={event => setAlbumId(event.target.value)}>
              <option value="">Publicar como single</option>
              {albums.map(album => (
                <option key={album.albumId} value={album.albumId}>{album.title}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              {albums.length ? 'Puedes publicarla como single o agregarla a un álbum existente.' : 'Crea un álbum para poder asociar canciones desde aquí.'}
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
        <button className="btn-primary" onClick={handlePublish} disabled={isSubmitting}>
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
    const normalizedTitle = normalizeText(title);
    const normalizedGenre = normalizeText(genre);

    if (hasEmptyTrackFields({ title, genre, audioFile, coverFile })) {
      return setError('Todos los campos son obligatorios.');
    }
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título de la canción no puede superar 220 caracteres.');
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
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-card" style={{ maxWidth: 760 }}>
      <div className="settings-card-title">Agregar canción a {album.title}</div>
      <div className="form-group-mb">
        <label className="form-label" htmlFor="album-created-track-title">Título de la canción</label>
        <input
          id="album-created-track-title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Título de la canción"
          maxLength={TRACK_TITLE_MAX_LENGTH}
          disabled={isSubmitting}
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
          disabled={isSubmitting}
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
      <button className="btn-primary" onClick={handleCreateTrack} disabled={isSubmitting}>
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
    if (normalizedTitle.length > ALBUM_TITLE_MAX_LENGTH) return setError('El título no puede superar 220 caracteres.');
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
  const [albums, setAlbums] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    setTitle(track?.title ?? '');
    setGenre(track?.genre ?? '');
    setAlbumId(track?.albumId ?? '');
  }, [track]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    catalogService
      .listArtistAlbums(user.id)
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
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El título no puede superar 220 caracteres.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El género no puede superar 80 caracteres.');

    return {
      title: normalizedTitle,
      genre: normalizedGenre,
      albumId: albumId || null,
    };
  };

  const requestSave = () => {
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
      await catalogService.updateTrack(track.trackId, payload);
      toast('Cambios guardados');
      setPendingAction(null);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const retire = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await catalogService.retireTrack(track.trackId);
      toast('Pista retirada');
      setPendingAction(null);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {albums.map(album => (
              <option key={album.albumId} value={album.albumId}>{album.title}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
          La edición de audio y portada estará disponible próximamente.
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn-danger" onClick={() => setPendingAction({ type: 'retire' })} disabled={isSubmitting}>Retirar pista</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
            <button className="btn-primary" onClick={requestSave} disabled={isSubmitting}>Guardar cambios</button>
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
        open={pendingAction?.type === 'retire'}
        title="Retirar pista"
        message={`Esta acción retirará "${track.title}". Los oyentes ya no podrán reproducirla desde la app.`}
        confirmLabel="Retirar pista"
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
              <div className="section-title">5 canciones principales</div>
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
                <table className="data-table">
                  <thead><tr><th>Canción</th><th>Reproducciones</th><th>Oyentes únicos</th></tr></thead>
                  <tbody>
                    {summary.tracks.map(track => (
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
        </>
      )}
    </div>
  );
}

ArtistAnalyticsPage.propTypes = {
  user: artistUserPropType.isRequired,
};


