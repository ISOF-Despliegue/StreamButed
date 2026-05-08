import { useCallback, useEffect, useRef, useState } from 'react';
import { IcMusic } from '../../components/icons/Icons';
import { TrackRow } from '../../components/ui/TrackRow';
import { FilePicker } from '../../components/ui/FilePicker';
import { catalogService } from '../../services/catalogService';
import { mediaService } from '../../services/mediaService';
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
    };
    fileType = extToMime[ext] || '';
  }
  
  if (!fileType || !ALLOWED_AUDIO_TYPES.has(fileType)) {
    return 'Formato de audio invalido. Usa MP3, WAV, FLAC, OGG o WEBM.';
  }
  if (file.size > MAX_AUDIO_SIZE_BYTES) return 'El audio supera el maximo de 200 MB.';
  return '';
}

function createEmptyAlbumTrackDraft(id) {
  return {
    id,
    title: '',
    audioFile: null,
  };
}

function collectAlbumTracksToPublish(albumTracks) {
  const hasAnyTrackData = albumTracks.some((track) =>
    normalizeText(track.title).length > 0 || track.audioFile
  );

  if (!hasAnyTrackData) {
    return { tracksToPublish: [], errorMessage: '' };
  }

  const tracksToPublish = [];
  for (const track of albumTracks) {
    const normalizedTrackTitle = normalizeText(track.title);
    const hasTitle = normalizedTrackTitle.length > 0;
    const hasAudio = Boolean(track.audioFile);

    if (!hasTitle && !hasAudio) {
      continue;
    }

    if (!hasTitle || !hasAudio) {
      return {
        tracksToPublish: [],
        errorMessage: 'Cada cancion debe incluir titulo y archivo de audio, o dejarse vacia.'
      };
    }

    if (normalizedTrackTitle.length > TRACK_TITLE_MAX_LENGTH) {
      return {
        tracksToPublish: [],
        errorMessage: 'El titulo de cada cancion no puede superar 220 caracteres.'
      };
    }

    const audioError = validateAudio(track.audioFile);
    if (audioError) {
      return {
        tracksToPublish: [],
        errorMessage: audioError
      };
    }

    tracksToPublish.push({
      title: normalizedTrackTitle,
      audioFile: track.audioFile,
    });
  }

  return { tracksToPublish, errorMessage: '' };
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

function shortId(value) {
  return value ? `${value.slice(0, 8)}...` : 'Sin album';
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
                <thead><tr><th style={{ width: 40 }}>#</th><th>Titulo</th><th>Genero</th><th style={{ textAlign: 'right' }}>Duracion</th></tr></thead>
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

  const retire = async (trackId) => {
    try {
      await catalogService.retireTrack(trackId);
      toast('Pista retirada');
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
                        <div className="track-thumb"><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div></div>
                        <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{track.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>{shortId(track.trackId)}</div></div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{track.genre || 'Sin genero'}</td>
                    <td style={{ color: 'var(--t2)' }}>{track.albumId ? albumTitleById.get(track.albumId) ?? shortId(track.albumId) : 'Single'}</td>
                    <td style={{ color: 'var(--t2)' }}>{track.status}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(track.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => { setEditTrack(track); setPage('artist-edit-track'); }}>Editar</button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => retire(track.trackId)}>Retirar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function MyAlbumsPage({ user, setPage, setUploadAlbumId, toast }) {
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  const retire = async (albumId) => {
    try {
      await catalogService.retireAlbum(albumId);
      toast('Album retirado');
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
                        <div className="track-thumb"><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div></div>
                        <div><div style={{ fontWeight: 500, color: 'var(--t1)' }}>{album.title}</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>{shortId(album.albumId)}</div></div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--t2)' }}>{countTracks(album.albumId)}</td>
                    <td style={{ color: 'var(--t2)' }}>{album.status}</td>
                    <td style={{ color: 'var(--t2)' }}>{formatDate(album.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => addTrackToAlbum(album.albumId)}>Agregar cancion</button>
                        <button className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => retire(album.albumId)}>Retirar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function UploadSinglePage({ user, toast, initialAlbumId = null, onUploadAlbumConsumed = undefined }) {
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
      const cover = await mediaService.uploadCatalogImage(coverFile, 'TRACK_COVER');
      const payload = {
        title: normalizedTitle,
        genre: normalizedGenre,
        audioAssetId: audio.assetId,
        coverAssetId: cover.assetId,
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
      onUploadAlbumConsumed?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">Upload Single</div></div>

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

export function CreateAlbumPage({ toast }) {
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const nextTrackIdRef = useRef(2);
  const [albumTracks, setAlbumTracks] = useState([createEmptyAlbumTrackDraft(1)]);
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

    const { tracksToPublish, errorMessage } = collectAlbumTracksToPublish(albumTracks);
    if (errorMessage) {
      return setError(errorMessage);
    }

    setError('');
    setIsSubmitting(true);

    try {
      const cover = await mediaService.uploadCatalogImage(coverFile, 'ALBUM_COVER');
      const album = await catalogService.createAlbum({
        title: normalizedTitle,
        coverAssetId: cover.assetId,
      });

      for (const track of tracksToPublish) {
        const audio = await mediaService.uploadAudio(track.audioFile);
        await catalogService.createTrackInAlbum(album.albumId, {
          title: track.title,
          genre: 'Otro',
          audioAssetId: audio.assetId,
          coverAssetId: cover.assetId,
        });
      }

      setTitle('');
      setCoverFile(null);
      setAlbumTracks([createEmptyAlbumTrackDraft(1)]);
      nextTrackIdRef.current = 2;
      toast(
        tracksToPublish.length
          ? `Album creado con ${tracksToPublish.length} canciones.`
          : 'Album creado'
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addAlbumTrackRow = () => {
    const id = nextTrackIdRef.current;
    nextTrackIdRef.current += 1;
    setAlbumTracks((currentTracks) => [...currentTracks, createEmptyAlbumTrackDraft(id)]);
  };

  const removeAlbumTrackRow = (trackId) => {
    setAlbumTracks((currentTracks) => {
      if (currentTracks.length === 1) {
        return [createEmptyAlbumTrackDraft(1)];
      }

      return currentTracks.filter((track) => track.id !== trackId);
    });
  };

  const updateAlbumTrackTitle = (trackId, value) => {
    setAlbumTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, title: value } : track
      )
    );
  };

  const handleAlbumTrackAudioChange = (trackId, event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    const audioError = selectedFile ? validateAudio(selectedFile) : '';

    if (audioError) {
      event.target.value = '';
      setAlbumTracks((currentTracks) =>
        currentTracks.map((track) =>
          track.id === trackId ? { ...track, audioFile: null } : track
        )
      );
      setError(audioError);
      return;
    }

    setError('');
    setAlbumTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, audioFile: selectedFile } : track
      )
    );
  };

  return (
    <div className="page-inner">
      <div className="page-header"><div className="page-title">Create Album</div></div>
      <div className="settings-card" style={{ maxWidth: 760 }}>
        <div className="settings-card-title">Album Info</div>
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
        <div className="form-group-mb">
          <div className="form-label">Canciones del album (opcional)</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {albumTracks.map((track, index) => (
              <div
                key={track.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--surface-2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--t2)' }}>Cancion #{index + 1}</div>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => removeAlbumTrackRow(track.id)}
                    type="button"
                    disabled={isSubmitting}
                  >
                    Quitar
                  </button>
                </div>

                <div className="form-group-mb" style={{ marginBottom: 10 }}>
                  <label className="form-label" htmlFor={`album-track-title-${track.id}`}>Nombre de la cancion</label>
                  <input
                    id={`album-track-title-${track.id}`}
                    value={track.title}
                    onChange={(event) => updateAlbumTrackTitle(track.id, event.target.value)}
                    placeholder="Titulo de la cancion"
                    maxLength={TRACK_TITLE_MAX_LENGTH}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <FilePicker
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/webm"
                    file={track.audioFile}
                    onChange={(event) => handleAlbumTrackAudioChange(track.id, event)}
                    helperText="MP3, WAV, FLAC, OGG o WEBM - max 200 MB"
                    buttonLabel="Seleccionar archivo"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={addAlbumTrackRow}
            type="button"
            disabled={isSubmitting}
          >
            + Agregar otra cancion
          </button>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
            Solo se requiere nombre y audio. El genero se establece como "Otro" automaticamente.
          </div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Publicar Album'}
        </button>
      </div>
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

  const save = async () => {
    const normalizedTitle = normalizeText(title);
    const normalizedGenre = normalizeText(genre);

    if (!normalizedTitle) return setError('Titulo requerido.');
    if (normalizedTitle.length > TRACK_TITLE_MAX_LENGTH) return setError('El titulo no puede superar 220 caracteres.');
    if (!normalizedGenre) return setError('Genero requerido.');
    if (normalizedGenre.length > GENRE_MAX_LENGTH) return setError('El genero no puede superar 80 caracteres.');

    setError('');
    setIsSubmitting(true);

    try {
      await catalogService.updateTrack(track.trackId, {
        title: normalizedTitle,
        genre: normalizedGenre,
        albumId: albumId || null,
      });
      toast('Cambios guardados');
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
          <button className="btn-danger" onClick={retire} disabled={isSubmitting}>Retirar Track</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={() => setPage('artist-tracks')}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={isSubmitting}>Save Changes</button>
          </div>
        </div>
      </div>
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
