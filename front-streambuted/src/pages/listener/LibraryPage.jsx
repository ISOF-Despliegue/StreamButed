import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IcMusic, IcPlay, IcX } from '../../components/icons/Icons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FilePicker } from '../../components/ui/FilePicker';
import { InlineState } from '../../components/ui/InlineState';
import { SearchInput } from '../../components/ui/SearchInput';
import { TrackRow } from '../../components/ui/TrackRow';
import { useSearchController } from '../../hooks/useSearchController';
import { browserLogger } from '../../utils/browserLogger';
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

function getErrorMessage(error) {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return 'No se pudo cargar la biblioteca.';
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
          <div className="library-playlist-meta">
            {playlist.trackCount} {playlist.trackCount === 1 ? 'cancion' : 'canciones'}
          </div>
        </div>
      </button>
      <button className="library-playlist-delete" onClick={onDelete} title="Eliminar playlist" type="button">
        <IcX />
      </button>
    </div>
  );
}

export function LibraryPage({ currentTrack, onPlayCollectionTrack, toast }) {
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

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setLibrary(await libraryService.getLibrary());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLikedSongs = useCallback(async () => {
    try {
      const likedSongs = await libraryService.getLikedSongs();
      setLibrary((current) => (current ? { ...current, likedSongs } : current));
    } catch (error) {
      browserLogger.warn('Failed to refresh liked songs library section.', error);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => (
    subscribeToLibraryEvents((event) => {
      if (event.type === 'liked-songs-changed') {
        void refreshLikedSongs();
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
  ), [refreshLikedSongs]);

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
      setPlaylistName('');
      setPlaylistCoverFile(null);
      setIsCreateDialogOpen(false);
      toast('Playlist creada');
    } catch (err) {
      toast(getErrorMessage(err));
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
      toast(getErrorMessage(err));
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
                  {likedSongs.trackCount} {likedSongs.trackCount === 1 ? 'cancion guardada' : 'canciones guardadas'}
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
          setIsCreateDialogOpen(false);
          setPlaylistName('');
          setPlaylistCoverFile(null);
        }}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="playlist-name">Nombre</label>
          <input
            id="playlist-name"
            aria-label="Nombre de playlist"
            data-dialog-autofocus
            value={playlistName}
            onChange={event => setPlaylistName(event.target.value)}
            placeholder="Nueva playlist"
            maxLength={PLAYLIST_NAME_MAX_LENGTH}
          />
          <div className="char-count">{playlistName.length}/{PLAYLIST_NAME_MAX_LENGTH}</div>
        </div>
        <div className="form-group">
          <div className="form-label">Portada</div>
          <FilePicker
            accept="image/png,image/jpeg,image/webp"
            file={playlistCoverFile}
            onChange={event => setPlaylistCoverFile(event.target.files?.[0] ?? null)}
            helperText={PLAYLIST_IMAGE_HELPER}
            buttonLabel="Seleccionar archivo"
          />
          {playlistCoverPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={playlistCoverPreviewUrl}
                alt="Previsualizacion de portada de playlist"
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
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
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
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
        setError(getErrorMessage(err));
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

  const playlistTrackSearchController = useSearchController({
    onClear: useCallback(() => setPlaylistTrackSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setPlaylistTrackSearchTerm(searchTerm), []),
  });

  const addCurrentTrack = async () => {
    const trackId = getTrackIdentifier(currentTrack);
    if (!trackId || !playlistId || isAddingCurrent) return;

    setIsAddingCurrent(true);
    try {
      const updatedPlaylist = await libraryService.addTrackToPlaylist(playlistId, trackId);
      setPlaylist(updatedPlaylist);
      emitPlaylistUpdated(updatedPlaylist);
      toast('Cancion agregada a la playlist');
    } catch (err) {
      toast(getErrorMessage(err));
    } finally {
      setIsAddingCurrent(false);
    }
  };

  const removeTrack = async (trackId) => {
    if (!playlistId) return;

    try {
      const updatedPlaylist = await libraryService.removeTrackFromPlaylist(playlistId, trackId);
      setPlaylist(updatedPlaylist);
      emitPlaylistUpdated(updatedPlaylist);
      toast('Cancion quitada de la playlist');
    } catch (err) {
      toast(getErrorMessage(err));
    }
  };

  const updatePlaylistCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !playlistId || isUpdatingCover) return;

    setIsUpdatingCover(true);
    try {
      const upload = await mediaService.uploadPlaylistCover(file);
      const updated = await libraryService.updatePlaylist(playlistId, { coverAssetId: upload.assetId });
      setPlaylist(current => (current ? { ...current, coverAssetId: updated.coverAssetId } : current));
      emitPlaylistUpdated(updated);
      toast('Portada actualizada');
    } catch (err) {
      toast(getErrorMessage(err));
    } finally {
      setIsUpdatingCover(false);
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
  const isSystemPlaylist = Boolean(playlist.isSystem);
  const currentTrackId = getTrackIdentifier(currentTrack);
  const hasCurrentTrack = Boolean(currentTrackId && tracks.some(track => track.trackId === currentTrackId));
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
              {playlist.trackCount} {playlist.trackCount === 1 ? 'cancion' : 'canciones'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="btn-ghost">
            {isUpdatingCover ? 'Subiendo...' : 'Cambiar portada'}
            <input
              className="file-picker-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={isUpdatingCover}
              onChange={updatePlaylistCover}
            />
          </label>
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
          title={isSystemPlaylist ? 'Aun no has dado me gusta a canciones' : 'Playlist vacia'}
          message={isSystemPlaylist
            ? 'Usa el corazon del reproductor para guardarlas aqui.'
            : 'Reproduce una cancion y agregala desde este detalle.'}
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
                <th>Categoria</th>
                <th className="track-duration-col">Duracion</th>
                {!isSystemPlaylist && <th style={{ width: 110 }}>Acciones</th>}
              </tr></thead>
              <tbody>
                {filteredTracks.map((track, index) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    index={index}
                    isPlaying={currentTrack?.trackId === track.trackId}
                    onPlay={() => onPlayTrack(track, tracks, playlist.playlistId)}
                    metaText={track.genre || 'Sin genero'}
                    actions={!isSystemPlaylist ? (
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
                    ) : undefined}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
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
