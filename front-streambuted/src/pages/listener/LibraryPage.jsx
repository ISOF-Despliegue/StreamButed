import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { TrackRowLibraryActions } from '../../components/layout/TrackRowLibraryActions';
import { IcCheck, IcEdit, IcMusic, IcPlay, IcPlus, IcX } from '../../components/icons/Icons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FilePicker } from '../../components/ui/FilePicker';
import { InlineState } from '../../components/ui/InlineState';
import { SearchInput } from '../../components/ui/SearchInput';
import { TrackRow } from '../../components/ui/TrackRow';
import { useSearchController } from '../../hooks/useSearchController';
import { browserLogger } from '../../utils/browserLogger';
import { catalogService } from '../../services/catalogService';
import { libraryService } from '../../services/libraryService';
import {
  emitPlaylistCreated,
  emitPlaylistDeleted,
  emitPlaylistUpdated,
  subscribeToLibraryEvents,
} from '../../services/libraryEvents';
import { getAssetUrl, getUploadFileHelperText, mediaService } from '../../services/mediaService';
import { routes } from '../../routes/appRoutes';
import { toPlaylistSummary } from '../../utils/libraryEventPayloads';
import { getTrackIdentifier } from '../../utils/playbackQueue';
import { includesSearchTerm } from '../../utils/searchText';
import { toUserFacingMessage } from '../../utils/userFacingMessages';

const PLAYLIST_NAME_MAX_LENGTH = 20;
const PLAYLIST_IMAGE_HELPER = `JPG, PNG o WEBP - maximo 5 MB. ${getUploadFileHelperText('portada-01.png')}`;

function getErrorMessage(error, fallback = 'No se pudo completar la solicitud.') {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return fallback;
}

function toPlayableTrack(track) {
  return {
    ...track,
    artist: track.artistName,
    artistName: track.artistName,
  };
}

function PlaylistCover({ coverAssetId, className }) {
  return (
    <div className={className}>
      {coverAssetId ? (
        <img src={getAssetUrl(coverAssetId)} alt="" />
      ) : (
        <IcMusic />
      )}
    </div>
  );
}

function PlaylistSummaryCard({ playlist, onOpen, onDelete }) {
  return (
    <div className="library-playlist-card">
      <button className="library-playlist-main" onClick={onOpen} type="button">
        <PlaylistCover coverAssetId={playlist.coverAssetId} className="library-playlist-cover" />
        <div>
          <div className="library-playlist-title">{playlist.name}</div>
        </div>
      </button>
      <button className="library-playlist-delete" onClick={onDelete} title="Eliminar playlist" type="button">
        <IcX />
      </button>
    </div>
  );
}

function PlaylistEditorFields({
  coverPreviewUrl,
  file,
  helperText = PLAYLIST_IMAGE_HELPER,
  name,
  onFileChange,
  onNameChange,
  showName = true,
}) {
  return (
    <>
      {showName && (
        <div className="form-group">
          <label className="form-label" htmlFor="playlist-name">Nombre</label>
          <input
            id="playlist-name"
            aria-label="Nombre de playlist"
            data-dialog-autofocus
            value={name}
            onChange={onNameChange}
            placeholder="Nueva playlist"
            maxLength={PLAYLIST_NAME_MAX_LENGTH}
          />
          <div className="char-count">{name.length}/{PLAYLIST_NAME_MAX_LENGTH}</div>
        </div>
      )}
      <div className="form-group">
        <div className="form-label">Portada</div>
        <FilePicker
          accept="image/png,image/jpeg,image/webp"
          file={file}
          onChange={onFileChange}
          helperText={helperText}
          buttonLabel="Seleccionar archivo"
        />
        {coverPreviewUrl && (
          <div style={{ marginTop: 10 }}>
            <img
              src={coverPreviewUrl}
              alt="Previsualizacion de portada de playlist"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </div>
        )}
      </div>
    </>
  );
}

function PlaylistAddTrackButton({ disabled = false, isAdded = false, onClick }) {
  return (
    <button
      aria-label={isAdded ? 'La canción ya esta en la playlist' : 'Agregar canción a la playlist'}
      className={`btn-icon${isAdded ? ' active' : ''}`}
      disabled={disabled || isAdded}
      onClick={onClick}
      title={isAdded ? 'Ya esta en la playlist' : 'Agregar canción'}
      type="button"
    >
      {isAdded ? <IcCheck /> : <IcPlus />}
    </button>
  );
}

function PlaylistSongResults({
  emptyMessage,
  isAddingTrack,
  onAddTrack,
  playlistTrackIds,
  tracks,
}) {
  if (tracks.length === 0) {
    return <InlineState title={emptyMessage} />;
  }

  return (
    <table className="track-list">
      <thead><tr>
        <th style={{ width: 40 }}>#</th>
        <th>Titulo</th>
        <th>Genero</th>
        <th style={{ width: 88 }}>Agregar</th>
      </tr></thead>
      <tbody>
        {tracks.map((track, index) => {
          const isAdded = playlistTrackIds.has(track.trackId);

          return (
            <tr key={track.trackId} className="track-row track-row-static">
              <td><span className="track-num">{index + 1}</span></td>
              <td>
                <div className="track-title-cell">
                  <div className="track-thumb">
                    {track.coverAssetId ? (
                      <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IcMusic /></div>
                    )}
                  </div>
                  <div>
                    <div className="track-name">{track.title}</div>
                    <div className="track-artist-label">{track.artistName || 'Artista'}</div>
                  </div>
                </div>
              </td>
              <td><span className="track-meta-text">{track.genre || 'Sin genero'}</span></td>
              <td className="track-actions-cell" onClick={event => event.stopPropagation()}>
                <PlaylistAddTrackButton
                  disabled={isAddingTrack}
                  isAdded={isAdded}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddTrack(track.trackId).catch(() => undefined);
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function LibraryPage({ currentTrack, onPlayCollectionTrack, toast }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [library, setLibrary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdatingLikedCover, setIsUpdatingLikedCover] = useState(false);
  const [error, setError] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistCoverFile, setPlaylistCoverFile] = useState(null);
  const [playlistCoverPreviewUrl, setPlaylistCoverPreviewUrl] = useState('');
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const resetCreateDialog = useCallback(() => {
    setIsCreateDialogOpen(false);
    setPlaylistName('');
    setPlaylistCoverFile(null);
  }, []);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setLibrary(await libraryService.getLibrary());
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar la biblioteca.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLikedSongs = useCallback(async () => {
    try {
      const likedSongs = await libraryService.getLikedSongs();
      setLibrary((current) => (current ? { ...current, likedSongs } : current));
    } catch (refreshError) {
      browserLogger.warn('Failed to refresh liked songs library section.', refreshError);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === routes.library || location.pathname === '/') {
      void loadLibrary();
    }
  }, [loadLibrary, location.pathname]);

  useEffect(() => (
    subscribeToLibraryEvents((event) => {
      if (event.type === 'liked-songs-changed') {
        void refreshLikedSongs();
        return;
      }

      if (event.type === 'library-refresh-requested') {
        void loadLibrary();
        return;
      }

      if (event.type === 'playlist-created') {
        setLibrary((current) => (
          current
            ? { ...current, playlists: [...current.playlists, event.playlist] }
            : current
        ));
        return;
      }

      if (event.type === 'playlist-deleted') {
        setLibrary((current) => (
          current
            ? {
              ...current,
              playlists: current.playlists.filter((playlist) => playlist.playlistId !== event.playlistId),
            }
            : current
        ));
        return;
      }

      if (event.type === 'playlist-updated' && event.playlist) {
        if (event.playlist.isSystem) {
          const likedSongsSummary = toPlaylistSummary(event.playlist);
          setLibrary((current) => (
            current && likedSongsSummary
              ? {
                ...current,
                likedSongs: {
                  ...current.likedSongs,
                  ...likedSongsSummary,
                },
              }
              : current
          ));
          return;
        }

        const playlistSummary = toPlaylistSummary(event.playlist);
        setLibrary((current) => (
          current && playlistSummary
            ? {
              ...current,
              playlists: current.playlists.map((playlist) => (
                playlist.playlistId === playlistSummary.playlistId
                  ? { ...playlist, ...playlistSummary }
                  : playlist
              )),
            }
            : current
        ));
      }
    })
  ), [loadLibrary, refreshLikedSongs]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void loadLibrary();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadLibrary();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadLibrary]);

  useEffect(() => {
    if (!playlistCoverFile) {
      setPlaylistCoverPreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(playlistCoverFile);
    setPlaylistCoverPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [playlistCoverFile]);

  const createPlaylist = async () => {
    const name = playlistName.trim();
    if (!name || isCreating) return;
    if (library?.playlists?.some((playlist) => playlist.name === name)) {
      resetCreateDialog();
      toast('Ya existe una playlist con ese nombre.');
      return;
    }

    setIsCreating(true);
    try {
      const coverUpload = playlistCoverFile
        ? await mediaService.uploadPlaylistCover(playlistCoverFile)
        : null;
      const createdPlaylist = await libraryService.createPlaylist({
        name,
        coverAssetId: coverUpload?.assetId ?? null,
      });
      const createdPlaylistSummary = toPlaylistSummary(createdPlaylist);
      if (createdPlaylistSummary) {
        emitPlaylistCreated(createdPlaylistSummary);
      }
      resetCreateDialog();
      toast('Playlist creada');
    } catch (err) {
      resetCreateDialog();
      toast(getErrorMessage(err, 'No se pudo crear la playlist.'));
    } finally {
      setIsCreating(false);
    }
  };

  const updateLikedCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !library?.likedSongs?.playlistId || isUpdatingLikedCover) return;

    setIsUpdatingLikedCover(true);
    try {
      const upload = await mediaService.uploadPlaylistCover(file);
      const updatedLikedSongs = await libraryService.updatePlaylist(library.likedSongs.playlistId, { coverAssetId: upload.assetId });
      emitPlaylistUpdated(updatedLikedSongs);
      toast('Portada actualizada');
    } catch (err) {
      toast(getErrorMessage(err));
    } finally {
      setIsUpdatingLikedCover(false);
    }
  };

  const deletePlaylist = async () => {
    if (!playlistToDelete?.playlistId) return;

    try {
      await libraryService.deletePlaylist(playlistToDelete.playlistId);
      emitPlaylistDeleted(playlistToDelete.playlistId);
      toast('Playlist eliminada');
      setPlaylistToDelete(null);
    } catch (err) {
      setPlaylistToDelete(null);
      toast(getErrorMessage(err, 'No se pudo eliminar la playlist.'));
    }
  };

  const likedSongs = library?.likedSongs;
  const likedTracks = likedSongs?.tracks ?? [];
  const playableLikedTracks = likedTracks.map(toPlayableTrack);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Biblioteca</div>
        <div className="page-subtitle">Tus canciones guardadas y playlists privadas.</div>
      </div>

      {isLoading && <InlineState title="Cargando biblioteca..." />}
      {error && <InlineState title="No se pudo cargar tu biblioteca" message={error} onRetry={loadLibrary} />}

      {!isLoading && !error && library && (
        <>
          <div className="library-hero">
            <button
              aria-label={`Abrir playlist ${likedSongs.name}`}
              className="library-liked-main"
              onClick={() => navigate(routes.libraryPlaylist(likedSongs.playlistId))}
              type="button"
            >
              <PlaylistCover coverAssetId={likedSongs.coverAssetId} className="library-liked-cover" />
              <div className="library-liked-copy">
                <div className="album-hero-type">Playlist</div>
                <div className="library-liked-title">Canciones que te gustan</div>
                <div className="library-liked-meta">
                  {likedSongs.trackCount} {likedSongs.trackCount === 1 ? 'canción guardada' : 'canciones guardadas'}
                </div>
              </div>
            </button>
            <label className="btn-ghost library-cover-action">
              {isUpdatingLikedCover ? 'Subiendo...' : 'Cambiar portada'}
              <input
                className="file-picker-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isUpdatingLikedCover}
                onChange={updateLikedCover}
              />
            </label>
            <button
              className="play-btn"
              disabled={playableLikedTracks.length === 0}
              onClick={() => onPlayCollectionTrack(playableLikedTracks[0], playableLikedTracks, likedSongs.playlistId)}
              title="Reproducir canciones que te gustan"
              type="button"
            >
              <IcPlay />
            </button>
          </div>

          <div className="section">
            <div className="section-header">
              <div className="section-title">Tus playlists</div>
              <button className="btn-primary" onClick={() => setIsCreateDialogOpen(true)} type="button">
                Crear playlist
              </button>
            </div>

            {library.playlists.length === 0 ? (
              <InlineState title="Sin playlists todavia" message="Crea una lista privada para organizar tus canciones." />
            ) : (
              <div className="library-playlist-grid">
                {library.playlists.map(playlist => (
                  <PlaylistSummaryCard
                    key={playlist.playlistId}
                    playlist={playlist}
                    onOpen={() => navigate(routes.libraryPlaylist(playlist.playlistId))}
                    onDelete={() => setPlaylistToDelete(playlist)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={isCreateDialogOpen}
        title="Crear playlist"
        message=""
        confirmLabel="Crear"
        tone="primary"
        isLoading={isCreating}
        disabled={!playlistName.trim()}
        onConfirm={createPlaylist}
        onCancel={() => {
          if (isCreating) return;
          resetCreateDialog();
        }}
      >
        <PlaylistEditorFields
          coverPreviewUrl={playlistCoverPreviewUrl}
          file={playlistCoverFile}
          name={playlistName}
          onFileChange={event => setPlaylistCoverFile(event.target.files?.[0] ?? null)}
          onNameChange={event => setPlaylistName(event.target.value)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(playlistToDelete)}
        title="Eliminar playlist"
        message={`Se eliminara "${playlistToDelete?.name ?? 'esta playlist'}" de tu biblioteca.`}
        confirmLabel="Eliminar"
        onConfirm={deletePlaylist}
        onCancel={() => setPlaylistToDelete(null)}
      />
    </div>
  );
}

export function PlaylistDetailPage({ playlistId, currentTrack, onPlayTrack, toast }) {
  const [playlist, setPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingCurrent, setIsAddingCurrent] = useState(false);
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddSongsDialogOpen, setIsAddSongsDialogOpen] = useState(false);
  const [isLoadingLikedSongs, setIsLoadingLikedSongs] = useState(false);
  const [isSearchingTracks, setIsSearchingTracks] = useState(false);
  const [isAddingDialogTrack, setIsAddingDialogTrack] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreviewUrl, setEditCoverPreviewUrl] = useState('');
  const [activeAddSongsTab, setActiveAddSongsTab] = useState('liked');
  const [likedSongsSearchValue, setLikedSongsSearchValue] = useState('');
  const [likedSongsSearchTerm, setLikedSongsSearchTerm] = useState('');
  const [likedSongCandidates, setLikedSongCandidates] = useState([]);
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [hasSearchedSongs, setHasSearchedSongs] = useState(false);
  const [error, setError] = useState('');
  const [playlistTrackSearchTerm, setPlaylistTrackSearchTerm] = useState('');

  const loadPlaylist = useCallback(async ({ silent = false } = {}) => {
    if (!playlistId) return;

    if (!silent) {
      setIsLoading(true);
      setError('');
    }

    try {
      setPlaylist(await libraryService.getPlaylist(playlistId));
    } catch (err) {
      if (silent) {
        browserLogger.warn(`Failed to silently refresh playlist ${playlistId}.`, err);
      } else {
        setError(getErrorMessage(err, 'No se pudo cargar la playlist.'));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [playlistId]);

  useEffect(() => {
    void loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => (
    subscribeToLibraryEvents((event) => {
      if (event.type === 'liked-songs-changed' && playlist?.isSystem) {
        void loadPlaylist({ silent: true });
        return;
      }

      if (event.type === 'library-refresh-requested') {
        void loadPlaylist({ silent: true });
        return;
      }

      if (event.type === 'playlist-updated' && event.playlist?.playlistId === playlistId) {
        if (Array.isArray(event.playlist.tracks)) {
          setPlaylist(event.playlist);
          return;
        }

        setPlaylist((current) => (current ? { ...current, ...event.playlist } : current));
        return;
      }

      if (event.type === 'playlist-deleted' && event.playlistId === playlistId) {
        setPlaylist(null);
        setError('Esta playlist ya no está disponible.');
      }
    })
  ), [loadPlaylist, playlist?.isSystem, playlistId]);

  useEffect(() => {
    if (!editCoverFile) {
      setEditCoverPreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(editCoverFile);
    setEditCoverPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [editCoverFile]);

  const playlistTrackSearchController = useSearchController({
    onClear: useCallback(() => setPlaylistTrackSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setPlaylistTrackSearchTerm(searchTerm), []),
  });

  const searchSongsController = useSearchController({
    onClear: useCallback(() => {
      setSearchCandidates([]);
      setSearchError('');
      setHasSearchedSongs(false);
    }, []),
    onSearch: useCallback(async (searchTerm) => {
      setIsSearchingTracks(true);
      setSearchError('');
      setHasSearchedSongs(true);

      try {
        const response = await catalogService.searchCatalog({
          searchTerm,
          limit: 20,
          offset: 0,
        });
        setSearchCandidates(
          (response.tracks ?? []).map(track => ({
            ...track,
            artistName: track.artistName ?? track.artist ?? 'Artista',
            albumTitle: track.albumTitle ?? null,
          }))
        );
      } catch (error_) {
        setSearchCandidates([]);
        setSearchError(getErrorMessage(error_, 'No se pudieron buscar canciones.'));
      } finally {
        setIsSearchingTracks(false);
      }
    }, []),
  });

  const resetEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditName('');
    setEditCoverFile(null);
  }, []);

  const openEditDialog = useCallback(() => {
    setEditName(playlist?.name ?? '');
    setEditCoverFile(null);
    setIsEditDialogOpen(true);
  }, [playlist]);

  const openAddSongsDialog = useCallback(async () => {
    setIsAddSongsDialogOpen(true);
    setActiveAddSongsTab('liked');
    setLikedSongsSearchValue('');
    setLikedSongsSearchTerm('');
    setSearchCandidates([]);
    setSearchError('');
    setHasSearchedSongs(false);

    if (likedSongCandidates.length > 0 || isLoadingLikedSongs) {
      return;
    }

    setIsLoadingLikedSongs(true);
    try {
      const likedSongs = await libraryService.getLikedSongs();
      setLikedSongCandidates(likedSongs.tracks ?? []);
    } catch (loadError) {
      toast(getErrorMessage(loadError, 'No se pudieron cargar tus me gusta.'));
    } finally {
      setIsLoadingLikedSongs(false);
    }
  }, [isLoadingLikedSongs, likedSongCandidates.length, toast]);

  const addCurrentTrack = async () => {
    const trackId = getTrackIdentifier(currentTrack);
    if (!trackId || !playlistId || isAddingCurrent) return;

    setIsAddingCurrent(true);
    try {
      const updatedPlaylist = await libraryService.addTrackToPlaylist(playlistId, trackId);
      setPlaylist(updatedPlaylist);
      emitPlaylistUpdated(updatedPlaylist);
      toast('Canción agregada a la playlist');
    } catch (err) {
      toast(getErrorMessage(err, 'No se pudo agregar la canción a la playlist.'));
    } finally {
      setIsAddingCurrent(false);
    }
  };

  const addTrackFromDialog = async (trackId) => {
    if (!playlistId || isAddingDialogTrack) {
      return;
    }

    setIsAddingDialogTrack(true);
    try {
      const updatedPlaylist = await libraryService.addTrackToPlaylist(playlistId, trackId);
      setPlaylist(updatedPlaylist);
      emitPlaylistUpdated(updatedPlaylist);
      toast('Canción agregada a la playlist');
    } catch (dialogError) {
      toast(getErrorMessage(dialogError, 'No se pudo agregar la canción a la playlist.'));
    } finally {
      setIsAddingDialogTrack(false);
    }
  };

  const removeTrack = async (trackId) => {
    if (!playlistId) return;

    try {
      const updatedPlaylist = await libraryService.removeTrackFromPlaylist(playlistId, trackId);
      setPlaylist(updatedPlaylist);
      emitPlaylistUpdated(updatedPlaylist);
      toast('Canción quitada de la playlist');
    } catch (err) {
      toast(getErrorMessage(err, 'No se pudo quitar la canción de la playlist.'));
    }
  };

  const savePlaylistEdits = async () => {
    if (!playlistId || isEditingPlaylist) {
      return;
    }

    const normalizedName = editName.trim();
    if (!playlist.isSystem && !normalizedName) {
      toast('Todos los campos son obligatorios.');
      return;
    }

    setIsEditingPlaylist(true);
    try {
      const upload = editCoverFile ? await mediaService.uploadPlaylistCover(editCoverFile) : null;
      const updatedPlaylist = await libraryService.updatePlaylist(playlistId, {
        ...(playlist.isSystem ? {} : { name: normalizedName }),
        ...(upload ? { coverAssetId: upload.assetId } : {}),
      });
      setPlaylist((current) => (current ? { ...current, ...updatedPlaylist } : current));
      emitPlaylistUpdated(updatedPlaylist);
      resetEditDialog();
      toast('Playlist actualizada');
    } catch (editError) {
      resetEditDialog();
      toast(getErrorMessage(editError, 'No se pudo actualizar la playlist.'));
    } finally {
      setIsEditingPlaylist(false);
    }
  };

  if (!playlistId) {
    return <div className="page-inner"><InlineState title="Playlist no seleccionada" /></div>;
  }

  if (isLoading) {
    return <div className="page-inner"><InlineState title="Cargando playlist..." /></div>;
  }

  if (error) {
    return <div className="page-inner"><InlineState title="No se pudo cargar la playlist" message={error} onRetry={loadPlaylist} /></div>;
  }

  if (!playlist) {
    return <div className="page-inner"><InlineState title="Playlist no encontrada" /></div>;
  }

  const tracks = playlist.tracks.map(toPlayableTrack);
  const playlistTrackIds = new Set((playlist.tracks ?? []).map(track => track.trackId));
  const isSystemPlaylist = Boolean(playlist.isSystem);
  const currentTrackId = getTrackIdentifier(currentTrack);
  const hasCurrentTrack = Boolean(currentTrackId && tracks.some(track => track.trackId === currentTrackId));
  const filteredLikedSongCandidates = likedSongsSearchTerm
    ? likedSongCandidates.filter(track => (
      includesSearchTerm(track.title, likedSongsSearchTerm) ||
      includesSearchTerm(track.artistName, likedSongsSearchTerm) ||
      includesSearchTerm(track.albumTitle, likedSongsSearchTerm)
    ))
    : likedSongCandidates;
  const filteredTracks = playlistTrackSearchTerm
    ? tracks.filter(track => (
      includesSearchTerm(track.title, playlistTrackSearchTerm) ||
      includesSearchTerm(track.artistName, playlistTrackSearchTerm) ||
      includesSearchTerm(track.albumTitle, playlistTrackSearchTerm)
    ))
    : tracks;

  return (
    <div className="page-inner">
      <div className="breadcrumb">
        <Link className="breadcrumb-link" to={routes.library}>Biblioteca</Link>
        <span>/</span><span>{playlist.name}</span>
      </div>
      <div className="my-tracks-header">
        <div className="playlist-detail-title-row">
          <PlaylistCover coverAssetId={playlist.coverAssetId} className="library-liked-cover playlist-detail-cover" />
          <div>
            <div className="page-title">{playlist.name}</div>
            <div className="page-subtitle">
              {playlist.trackCount} {playlist.trackCount === 1 ? 'canción' : 'canciones'}
            </div>
          </div>
        </div>
        <div className="playlist-detail-actions">
          <button className="btn-ghost" onClick={openEditDialog} type="button">
            <IcEdit />
            <span>Editar</span>
          </button>
          {!isSystemPlaylist && (
            <button className="btn-ghost" onClick={() => void openAddSongsDialog()} type="button">
              <IcPlus />
              <span>Agregar canciones</span>
            </button>
          )}
          {!isSystemPlaylist && (
            <button
              className="btn-ghost"
              disabled={!currentTrackId || hasCurrentTrack || isAddingCurrent}
              onClick={addCurrentTrack}
              type="button"
            >
              Agregar pista actual
            </button>
          )}
          <button
            className="btn-primary"
            disabled={tracks.length === 0}
            onClick={() => onPlayTrack(tracks[0], tracks, playlist.playlistId)}
            type="button"
          >
            Reproducir
          </button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <InlineState
          title={isSystemPlaylist ? 'Aún no has dado me gusta a canciones' : 'Playlist vacía'}
          message={isSystemPlaylist
            ? 'Usa el corazón del reproductor para guardarlas aqui.'
            : 'Usa "Agregar canciones" o agrega la pista actual desde este detalle.'}
        />
      ) : (
        <>
          <div className="table-header">
            <SearchInput
              cooldownUntil={playlistTrackSearchController.cooldownUntil}
              placeholder={isSystemPlaylist ? 'Buscar en tus me gusta' : 'Buscar en esta playlist'}
              value={playlistTrackSearchController.searchValue}
              onChange={playlistTrackSearchController.setSearchValue}
              onSubmit={playlistTrackSearchController.submitSearch}
            />
          </div>
          {filteredTracks.length === 0 ? (
            <InlineState title="Sin canciones para esta busqueda" />
          ) : (
            <table className="track-list">
              <thead><tr>
                <th style={{ width: 40 }}>#</th>
                <th>Titulo</th>
                <th style={{ width: isSystemPlaylist ? 120 : 220 }}>Acciones</th>
                <th>Genero</th>
                <th className="track-duration-col">Duracion</th>
              </tr></thead>
              <tbody>
                {filteredTracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    actionsPosition="before-meta"
                    onPlay={() => onPlayTrack(track, tracks, playlist.playlistId)}
                    metaText={track.genre || 'Sin genero'}
                    actions={(
                      <div className="track-actions-group">
                        <TrackRowLibraryActions className="track-actions-group" toast={toast} trackId={track.trackId} />
                        {!isSystemPlaylist && (
                          <button
                            className="btn-ghost"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeTrack(track.trackId);
                            }}
                            type="button"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    )}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <ConfirmDialog
        open={isEditDialogOpen}
        title="Editar playlist"
        message=""
        confirmLabel="Guardar"
        tone="primary"
        isLoading={isEditingPlaylist}
        disabled={!isSystemPlaylist && !editName.trim()}
        onConfirm={savePlaylistEdits}
        onCancel={() => {
          if (isEditingPlaylist) return;
          resetEditDialog();
        }}
      >
        <PlaylistEditorFields
          coverPreviewUrl={editCoverPreviewUrl || (playlist.coverAssetId ? getAssetUrl(playlist.coverAssetId) : '')}
          file={editCoverFile}
          name={editName}
          onFileChange={event => setEditCoverFile(event.target.files?.[0] ?? null)}
          onNameChange={event => setEditName(event.target.value)}
          showName={!isSystemPlaylist}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={isAddSongsDialogOpen}
        title="Agregar canciones"
        message=""
        confirmLabel="Cerrar"
        showCancel={false}
        tone="primary"
        onConfirm={() => setIsAddSongsDialogOpen(false)}
        onCancel={() => setIsAddSongsDialogOpen(false)}
      >
        <div className="playlist-picker-tabs">
          <button
            className={`role-tab${activeAddSongsTab === 'liked' ? ' active' : ''}`}
            onClick={() => setActiveAddSongsTab('liked')}
            type="button"
          >
            Tus Me Gusta
          </button>
          <button
            className={`role-tab${activeAddSongsTab === 'search' ? ' active' : ''}`}
            onClick={() => setActiveAddSongsTab('search')}
            type="button"
          >
            Buscar canciones
          </button>
        </div>

        {activeAddSongsTab === 'liked' ? (
          <div className="playlist-picker-panel">
            <SearchInput
              cooldownUntil={0}
              placeholder="Buscar en tus me gusta"
              value={likedSongsSearchValue}
              onChange={(value) => {
                setLikedSongsSearchValue(value);
                setLikedSongsSearchTerm(value.trim());
              }}
              onSubmit={() => setLikedSongsSearchTerm(likedSongsSearchValue.trim())}
            />
            {isLoadingLikedSongs ? (
              <InlineState title="Cargando tus me gusta..." />
            ) : (
              <PlaylistSongResults
                emptyMessage="No encontramos canciones en tus me gusta."
                isAddingTrack={isAddingDialogTrack}
                onAddTrack={addTrackFromDialog}
                playlistTrackIds={playlistTrackIds}
                tracks={filteredLikedSongCandidates}
              />
            )}
          </div>
        ) : (
          <div className="playlist-picker-panel">
            <SearchInput
              cooldownUntil={searchSongsController.cooldownUntil}
              placeholder="Buscar canciones"
              value={searchSongsController.searchValue}
              onChange={searchSongsController.setSearchValue}
              onSubmit={searchSongsController.submitSearch}
            />
            {isSearchingTracks && <InlineState title="Buscando canciones..." />}
            {!isSearchingTracks && searchError && (
              <InlineState title="No se pudo buscar" message={searchError} />
            )}
            {!isSearchingTracks && !searchError && hasSearchedSongs && (
              <PlaylistSongResults
                emptyMessage="No encontramos canciones para esta busqueda."
                isAddingTrack={isAddingDialogTrack}
                onAddTrack={addTrackFromDialog}
                playlistTrackIds={playlistTrackIds}
                tracks={searchCandidates}
              />
            )}
            {!isSearchingTracks && !searchError && !hasSearchedSongs && (
              <InlineState title="Busca canciones para agregarlas a esta playlist." />
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

const trackPropType = PropTypes.shape({
  artistName: PropTypes.string,
  trackId: PropTypes.string,
});

const playlistPropType = PropTypes.shape({
  coverAssetId: PropTypes.string,
  name: PropTypes.string.isRequired,
  playlistId: PropTypes.string.isRequired,
  trackCount: PropTypes.number.isRequired,
});

PlaylistCover.propTypes = {
  className: PropTypes.string.isRequired,
  coverAssetId: PropTypes.string,
};

PlaylistSummaryCard.propTypes = {
  onDelete: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
  playlist: playlistPropType.isRequired,
};

PlaylistEditorFields.propTypes = {
  coverPreviewUrl: PropTypes.string,
  file: PropTypes.instanceOf(File),
  helperText: PropTypes.string,
  name: PropTypes.string.isRequired,
  onFileChange: PropTypes.func.isRequired,
  onNameChange: PropTypes.func.isRequired,
  showName: PropTypes.bool,
};

PlaylistAddTrackButton.propTypes = {
  disabled: PropTypes.bool,
  isAdded: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

PlaylistSongResults.propTypes = {
  emptyMessage: PropTypes.string.isRequired,
  isAddingTrack: PropTypes.bool,
  onAddTrack: PropTypes.func.isRequired,
  playlistTrackIds: PropTypes.instanceOf(Set).isRequired,
  tracks: PropTypes.arrayOf(PropTypes.shape({
    albumTitle: PropTypes.string,
    artistName: PropTypes.string,
    coverAssetId: PropTypes.string,
    genre: PropTypes.string,
    trackId: PropTypes.string,
    title: PropTypes.string,
  })).isRequired,
};

LibraryPage.propTypes = {
  currentTrack: trackPropType,
  onPlayCollectionTrack: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
};

PlaylistDetailPage.propTypes = {
  currentTrack: trackPropType,
  onPlayTrack: PropTypes.func.isRequired,
  playlistId: PropTypes.string,
  toast: PropTypes.func.isRequired,
};
