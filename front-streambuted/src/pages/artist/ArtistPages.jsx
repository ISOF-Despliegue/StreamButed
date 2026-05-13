import { useCallback, useEffect, useState } from 'react';
import { IcMusic } from '../../components/icons/Icons';
import { TrackRow } from '../../components/ui/TrackRow';
import { FilePicker } from '../../components/ui/FilePicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { catalogService } from '../../services/catalogService';
import { getAssetUrl, mediaService } from '../../services/mediaService';
import { formatDate } from '../../utils/formatters';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo completar la solicitud.';
}

const TRACK_GENRES = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Electronica',
  'Regional',
  'Reggaeton',
  'Jazz',
  'Clasica',
  'Indie',
  'Otro',
];

const TRACK_TITLE_MAX_LENGTH = 220;
const ALBUM_TITLE_MAX_LENGTH = 220;
const GENRE_MAX_LENGTH = 80;

const MAX_AUDIO_SIZE_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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

function normalizeText(value) {
  return (value ?? '').trim();
}

function validateCoverImage(file) {
  if (!file) return 'Portada requerida por Catalog.';
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) return 'Formato de imagen invalido. Usa JPG, PNG o WEBP.';
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'La imagen supera el maximo de 5 MB.';
  return '';
}

function validateAudio(file) {
  if (!file) return 'Audio requerido.';
  
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
    return 'Formato de audio invalido. Usa MP3, WAV, FLAC, OGG o WEBM.';
  }
  if (file.size > MAX_AUDIO_SIZE_BYTES) return 'El audio supera el maximo de 200 MB.';
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

function InlineState({ title, message, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-text">{title}</div>
      {message && <div className="empty-sub">{message}</div>}
      {onRetry && <button className="btn-ghost" onClick={onRetry} style={{ marginTop: 14 }}>Reintentar</button>}
    </div>
  );
}

export function ArtistDashboardPage({ user, onPlayTrack, currentTrack, setPage }) {
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(async () => {
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

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="artist-view-badge">Artista</div>
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Bienvenido, {user.username}</div>
      </div>

      {isLoading && <InlineState title="Cargando catalogo de artista..." />}
      {error && (
        <InlineState
          title="Preparando perfil de artista"
          message="Catalog puede tardar unos segundos en crear el artista despues de la promocion por RabbitMQ."
          onRetry={loadCatalog}
        />
      )}

      {!isLoading && !error && (
        <>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-card-label">Pistas publicadas</div><div className="stat-card-value">{tracks.length}</div></div>
            <div className="stat-card"><div className="stat-card-label">Albums</div><div className="stat-card-value">{albums.length}</div></div>
            <div className="stat-card"><div className="stat-card-label">Analytics</div><div className="stat-card-value">Pendiente</div></div>
          </div>

          <div className="section">
            <div className="section-header">
              <div className="section-title">Mis pistas recientes</div>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setPage('artist-tracks')}>Ver todas</button>
            </div>
            {tracks.length === 0 ? (
              <InlineState title="Aun no tienes pistas" message="Sube audio y portada para crear tu primera pista real." />
            ) : (
              <table className="track-list">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Titulo</th><th>Genero</th><th className="track-duration-col">Duracion</th></tr></thead>
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
        </>
      )}
    </div>
  );
}

export function MyTracksPage({ user, setPage, setEditTrack, toast }) {
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!trackToRetire?.trackId) return;

    try {
      await catalogService.retireTrack(trackToRetire.trackId);
      toast('Pista retirada');
      setTrackToRetire(null);
      await loadTracks();
    } catch (err) {
      toast(getErrorMessage(err));
    }
  };

  return (
    <div className="page-inner">
      <div className="my-tracks-header">
        <div className="page-title">Mis Pistas</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setPage('artist-albums')}>Albums</button>
          <button className="btn-ghost" onClick={() => setPage('artist-upload')}>+ Subir Pista</button>
          <button className="btn-primary" onClick={() => setPage('artist-album')}>+ Crear Album</button>
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
              <thead><tr><th>Titulo</th><th>Genero</th><th>Album</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {tracks.map(track => (
                  <tr key={track.trackId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="track-thumb">
                          {track.coverAssetId ? (
                            <img src={getAssetUrl(track.coverAssetId)} alt={`Portada de ${track.title}`} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                          )}
                        </div>
                        <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{track.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>Pista publicada</div></div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{track.genre || 'Sin genero'}</td>
                    <td style={{ color: 'var(--t2)' }}>{track.albumId && albumTitleById.has(track.albumId) ? albumTitleById.get(track.albumId) : 'Single'}</td>
                    <td style={{ color: 'var(--t2)' }}>{track.status}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(track.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => { setEditTrack(track); setPage('artist-edit-track'); }}>Editar</button>
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
        message={`Esta accion retirara "${trackToRetire?.title ?? 'esta pista'}" del catalogo. Los oyentes ya no podran reproducirla desde la app.`}
        confirmLabel="Retirar pista"
        isLoading={isLoading}
        onConfirm={retire}
        onCancel={() => setTrackToRetire(null)}
      />
    </div>
  );
}

export function MyAlbumsPage({ user, setPage, setUploadAlbumId, toast }) {
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!albumToRetire?.albumId) return;

    try {
      await catalogService.retireAlbum(albumToRetire.albumId);
      toast('Album retirado');
      setAlbumToRetire(null);
      await loadAlbums();
    } catch (err) {
      toast(getErrorMessage(err));
    }
  };

  const addTrackToAlbum = (albumId) => {
    setUploadAlbumId(albumId);
    setPage('artist-upload');
  };

  const countTracks = (albumId) => tracks.filter(track => track.albumId === albumId).length;

  return (
    <div className="page-inner">
      <div className="my-tracks-header">
        <div className="page-title">Mis Albums</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setPage('artist-tracks')}>Pistas</button>
          <button className="btn-primary" onClick={() => setPage('artist-album')}>+ Crear Album</button>
        </div>
      </div>

      {isLoading && <InlineState title="Cargando albums..." />}
      {error && <InlineState title="No se pudieron cargar tus albums" message={error} onRetry={loadAlbums} />}

      {!isLoading && !error && (
        <div className="table-wrap">
          {albums.length === 0 ? (
            <InlineState title="Sin albums publicados" message="Crea un album y luego agrega canciones desde esta misma vista." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Album</th><th>Pistas</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
              <tbody>
                {albums.map(album => (
                  <tr key={album.albumId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="track-thumb">
                          {album.coverAssetId ? (
                            <img src={getAssetUrl(album.coverAssetId)} alt={`Portada de ${album.title}`} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                          )}
                        </div>
                        <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{album.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>Album publicado</div></div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{countTracks(album.albumId)}</td>
                    <td style={{ color: 'var(--t2)' }}>{album.status}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(album.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => addTrackToAlbum(album.albumId)}>Agregar cancion</button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => setAlbumToRetire(album)}>Retirar</button>
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
        title="Retirar album"
        message={`Esta accion retirara "${albumToRetire?.title ?? 'este album'}" del catalogo y afectara su disponibilidad para los oyentes.`}
        confirmLabel="Retirar album"
        isLoading={isLoading}
        onConfirm={retire}
        onCancel={() => setAlbumToRetire(null)}
      />
    </div>
  );
}

export function UploadSinglePage({ user, toast, initialAlbumId = null, onUploadAlbumConsumed = undefined }) {
  const isAlbumLocked = Boolean(initialAlbumId);
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [albumId, setAlbumId] = useState(initialAlbumId ?? '');
  const [albums, setAlbums] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAlbumId(initialAlbumId ?? '');
  }, [initialAlbumId]);

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

    if (!normalizedTitle) return setError('Titulo requerido.');
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El titulo no puede superar 220 caracteres.');
    if (!normalizedGenre) return setError('Genero requerido.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El genero no puede superar 80 caracteres.');

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
      toast(albumId ? 'Cancion agregada al album' : 'Pista publicada');
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
      <div className="page-header"><div className="page-title">{isAlbumLocked ? 'Agregar cancion al album' : 'Upload Single'}</div></div>

      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Audio</div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="upload-track-title">Track Title</label>
          <input
            id="upload-track-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Enter track title"
            maxLength={TRACK_TITLE_MAX_LENGTH}
          />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="upload-track-genre">Genero</label>
          <input
            id="upload-track-genre"
            list="track-genres"
            value={genre}
            onChange={event => setGenre(event.target.value)}
            placeholder="Rock, Pop, Electronica..."
            maxLength={GENRE_MAX_LENGTH}
          />
          <datalist id="track-genres">
            {TRACK_GENRES.map(option => <option key={option} value={option} />)}
          </datalist>
        </div>
        {isAlbumLocked ? (
          <div className="form-group-mb">
            <div className="form-label">Album destino</div>
            <div style={{ fontSize: 14, color: 'var(--t1)' }}>
              {albums.find(album => album.albumId === initialAlbumId)?.title ?? 'Album seleccionado'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              Esta cancion se agregara directamente a este album.
            </div>
          </div>
        ) : (
          <div className="form-group-mb">
            <label className="form-label" htmlFor="upload-track-album">Album destino</label>
            <select id="upload-track-album" value={albumId} onChange={event => setAlbumId(event.target.value)}>
              <option value="">Publicar como single</option>
              {albums.map(album => (
                <option key={album.albumId} value={album.albumId}>{album.title}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              {albums.length ? 'Puedes publicarla como single o agregarla a un album existente.' : 'Crea un album para poder asociar canciones desde aqui.'}
            </div>
          </div>
        )}
        <div className="form-group-mb">
          <div className="form-label">Audio file</div>
          <FilePicker
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/webm"
            file={audioFile}
            onChange={handleAudioChange}
            helperText="MP3, WAV, FLAC, OGG o WEBM - max 200 MB"
            buttonLabel="Seleccionar archivo"
          />
        </div>
        <div className="form-group-mb">
          <div className="form-label">Cover image</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={coverFile}
            onChange={handleCoverChange}
            helperText="JPG, PNG o WEBP - max 5 MB"
            buttonLabel="Seleccionar archivo"
          />
          {coverPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={coverPreviewUrl}
                alt="Previsualizacion de portada"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handlePublish} disabled={isSubmitting}>
          {isSubmitting ? 'Publicando...' : 'Publish Single'}
        </button>
      </div>
    </div>
  );
}

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

    if (!normalizedTitle) return setError('Titulo de la cancion requerido.');
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El titulo de la cancion no puede superar 220 caracteres.');
    if (!normalizedGenre) return setError('Genero requerido.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El genero no puede superar 80 caracteres.');

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
      onTrackCreated(createdTrack);
      toast('Cancion agregada al album');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-card" style={{ maxWidth: 760 }}>
      <div className="settings-card-title">Agregar cancion a {album.title}</div>
      <div className="form-group-mb">
        <label className="form-label" htmlFor="album-created-track-title">Titulo de la cancion</label>
        <input
          id="album-created-track-title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Titulo de la cancion"
          maxLength={TRACK_TITLE_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </div>
      <div className="form-group-mb">
        <label className="form-label" htmlFor="album-created-track-genre">Genero</label>
        <input
          id="album-created-track-genre"
          list="track-genres"
          value={genre}
          onChange={event => setGenre(event.target.value)}
          placeholder="Rock, Pop, Electronica..."
          maxLength={GENRE_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </div>
      <div className="form-group-mb">
        <div className="form-label">Audio file</div>
        <FilePicker
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/webm"
          file={audioFile}
          onChange={handleAudioChange}
          helperText="MP3, WAV, FLAC, OGG o WEBM - max 200 MB"
          buttonLabel="Seleccionar archivo"
        />
      </div>
      <div className="form-group-mb">
        <div className="form-label">Portada de la cancion</div>
        <FilePicker
          accept="image/png,image/jpeg,image/webp"
          file={coverFile}
          onChange={handleCoverChange}
          helperText="JPG, PNG o WEBP - max 5 MB"
          buttonLabel="Seleccionar archivo"
        />
        {coverPreviewUrl && (
          <div style={{ marginTop: 10 }}>
            <img
              src={coverPreviewUrl}
              alt="Previsualizacion de portada de la cancion"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </div>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      <button className="btn-primary" onClick={handleCreateTrack} disabled={isSubmitting}>
        {isSubmitting ? 'Agregando...' : 'Agregar cancion'}
      </button>
    </div>
  );
}

export function CreateAlbumPage({ toast }) {
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [createdAlbum, setCreatedAlbum] = useState(null);
  const [createdTracks, setCreatedTracks] = useState([]);
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
    if (!normalizedTitle) return setError('Titulo requerido.');
    if (normalizedTitle.length > ALBUM_TITLE_MAX_LENGTH) return setError('El titulo no puede superar 220 caracteres.');
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
      toast('Album creado');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">Create Album</div></div>
      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Album Info</div>
        {createdAlbum && (
          <div className="confirm-dialog-warning" style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)', marginBottom: 18 }}>
            Album "{createdAlbum.title}" creado. Ahora puedes agregar canciones con portada propia.
          </div>
        )}
        <div className="form-group-mb">
          <label className="form-label" htmlFor="create-album-title">Album Title</label>
          <input
            id="create-album-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Enter album title"
            maxLength={ALBUM_TITLE_MAX_LENGTH}
          />
        </div>
        <div className="form-group-mb">
          <div className="form-label">Cover image</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={coverFile}
            onChange={handleCoverChange}
            helperText="JPG, PNG o WEBP - max 5 MB"
            buttonLabel="Seleccionar archivo"
          />
          {coverPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={coverPreviewUrl}
                alt="Previsualizacion de portada del album"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Publicar Album'}
        </button>
      </div>

      {createdAlbum && (
        <>
          <AddTrackToAlbumForm
            album={createdAlbum}
            toast={toast}
            onTrackCreated={(track) => setCreatedTracks((currentTracks) => [track, ...currentTracks])}
          />
          <div className="settings-card" style={{ maxWidth: 760 }}>
            <div className="settings-card-title">Canciones agregadas</div>
            {createdTracks.length === 0 ? (
              <div style={{ fontSize: 14, color: 'var(--t2)' }}>Aun no has agregado canciones a este album.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {createdTracks.map(track => (
                  <div key={track.trackId} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t2)', fontSize: 13 }}>
                    <div className="track-thumb">
                      {track.coverAssetId ? (
                        <img src={getAssetUrl(track.coverAssetId)} alt={`Portada de ${track.title}`} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
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
        </>
      )}
    </div>
  );
}

export function EditTrackPage({ track, user, setPage, toast }) {
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

    if (!normalizedTitle) return setError('Titulo requerido.');
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El titulo no puede superar 220 caracteres.');
    if (!normalizedGenre) return setError('Genero requerido.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El genero no puede superar 80 caracteres.');

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
      setPage('artist-tracks');
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
      setPage('artist-tracks');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="breadcrumb">
        <a onClick={() => setPage('artist-tracks')}>Mis Pistas</a>
        <span>/</span><span>Editar Pista</span>
      </div>
      <div className="page-header"><div className="page-title">Edit Track</div></div>
      <div className="settings-card" style={{ maxWidth: 700 }}>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-title">Title</label>
          <input id="edit-track-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={TRACK_TITLE_MAX_LENGTH} />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-genre">Genero</label>
          <input id="edit-track-genre" list="edit-track-genres" value={genre} onChange={event => setGenre(event.target.value)} maxLength={GENRE_MAX_LENGTH} />
          <datalist id="edit-track-genres">
            {TRACK_GENRES.map(option => <option key={option} value={option} />)}
          </datalist>
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="edit-track-album">Album</label>
          <select id="edit-track-album" value={albumId} onChange={event => setAlbumId(event.target.value)}>
            <option value="">Single / sin album</option>
            {albums.map(album => (
              <option key={album.albumId} value={album.albumId}>{album.title}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
          Audio y portada se editan subiendo nuevos assets a Media en una futura mejora.
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn-danger" onClick={() => setPendingAction({ type: 'retire' })} disabled={isSubmitting}>Retirar Track</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={() => setPage('artist-tracks')}>Cancel</button>
            <button className="btn-primary" onClick={requestSave} disabled={isSubmitting}>Save Changes</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={pendingAction?.type === 'save'}
        title="Guardar cambios"
        message={`Confirma que deseas actualizar la informacion de "${track.title}". Los cambios se veran reflejados en el catalogo.`}
        confirmLabel="Guardar cambios"
        tone="primary"
        isLoading={isSubmitting}
        onConfirm={save}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction?.type === 'retire'}
        title="Retirar pista"
        message={`Esta accion retirara "${track.title}" del catalogo. Los oyentes ya no podran reproducirla desde la app.`}
        confirmLabel="Retirar pista"
        isLoading={isSubmitting}
        onConfirm={retire}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

export function ArtistAnalyticsPage() {
  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">Analiticas</div></div>
      <InlineState
        title="Analytics Service no esta disponible"
        message="Esta vista queda preparada para conectarse cuando el backend implemente endpoints de analitica. No se muestran metricas falsas."
      />
    </div>
  );
}
