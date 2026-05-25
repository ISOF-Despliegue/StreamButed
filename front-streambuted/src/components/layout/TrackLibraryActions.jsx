import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { IcHeart, IcPlus } from '../icons/Icons';
import { libraryService } from '../../services/libraryService';
import { emitPlaylistUpdated, subscribeToLibraryEvents } from '../../services/libraryEvents';
import { toPlaylistSummary } from '../../utils/libraryEventPayloads';
import { toUserFacingMessage } from '../../utils/userFacingMessages';

export function TrackLibraryActions({
  trackId,
  isLiked = false,
  isLikeLoading = false,
  onToggleLike = undefined,
  toast = undefined,
  className = '',
}) {
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [hasLoadedPlaylists, setHasLoadedPlaylists] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const playlistMenuRef = useRef(null);

  useEffect(() => {
    if (!isPlaylistMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!playlistMenuRef.current?.contains(event.target)) {
        setIsPlaylistMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isPlaylistMenuOpen]);

  useEffect(() => (
    subscribeToLibraryEvents((event) => {
      if (event.type === 'playlist-created') {
        setPlaylists((current) => {
          if (current.some((playlist) => playlist.playlistId === event.playlist.playlistId)) {
            return current.map((playlist) => (
              playlist.playlistId === event.playlist.playlistId ? event.playlist : playlist
            ));
          }

          return [...current, event.playlist];
        });
        return;
      }

      if (event.type === 'playlist-deleted') {
        setPlaylists((current) => current.filter((playlist) => playlist.playlistId !== event.playlistId));
        return;
      }

      if (event.type === 'playlist-updated' && event.playlist && !event.playlist.isSystem) {
        const playlistSummary = toPlaylistSummary(event.playlist);
        if (!playlistSummary) {
          return;
        }

        setPlaylists((current) => current.map((playlist) => (
          playlist.playlistId === playlistSummary.playlistId
            ? {
              ...playlist,
              ...playlistSummary,
            }
            : playlist
        )));
      }
    })
  ), []);

  const openPlaylistMenu = async () => {
    if (!trackId) return;

    const nextOpen = !isPlaylistMenuOpen;
    setIsPlaylistMenuOpen(nextOpen);
    if (!nextOpen || hasLoadedPlaylists || isLoadingPlaylists) return;

    setIsLoadingPlaylists(true);
    try {
      setPlaylists(await libraryService.listPlaylists());
      setHasLoadedPlaylists(true);
    } catch (error) {
      toast?.(toUserFacingMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus playlists.'));
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const addToPlaylist = async (playlistId) => {
    if (!trackId || isAddingToPlaylist) return;

    setIsAddingToPlaylist(true);
    try {
      const updatedPlaylist = await libraryService.addTrackToPlaylist(playlistId, trackId);
      emitPlaylistUpdated(updatedPlaylist);
      toast?.('Canción agregada a la playlist');
      setIsPlaylistMenuOpen(false);
    } catch (error) {
      toast?.(toUserFacingMessage(error instanceof Error ? error.message : 'No se pudo agregar la canción.'));
    } finally {
      setIsAddingToPlaylist(false);
    }
  };

  return (
    <div className={className}>
      <button
        aria-label={isLiked ? 'Quitar de canciones que te gustan' : 'Guardar en canciones que te gustan'}
        aria-pressed={isLiked}
        className={`btn-icon${isLiked ? ' active' : ''}`}
        disabled={isLikeLoading || !onToggleLike}
        onClick={onToggleLike}
        title={isLiked ? 'Quitar me gusta' : 'Me gusta'}
        type="button"
      >
        <IcHeart />
      </button>
      <div className="player-playlist-menu-wrap" ref={playlistMenuRef}>
        <button
          aria-expanded={isPlaylistMenuOpen}
          aria-label="Agregar a playlist"
          className="btn-icon"
          disabled={!trackId || isLoadingPlaylists}
          onClick={openPlaylistMenu}
          title="Agregar a playlist"
          type="button"
        >
          <IcPlus />
        </button>
        {isPlaylistMenuOpen && (
          <div className="player-playlist-menu" role="menu">
            <div className="player-playlist-menu-title">Agregar a playlist</div>
            {isLoadingPlaylists ? (
              <div className="player-playlist-menu-empty">Cargando...</div>
            ) : playlists.length === 0 ? (
              <div className="player-playlist-menu-empty">No tienes playlists privadas.</div>
            ) : (
              playlists.map((playlist) => (
                <button
                  className="player-playlist-option"
                  disabled={isAddingToPlaylist}
                  key={playlist.playlistId}
                  onClick={() => addToPlaylist(playlist.playlistId)}
                  role="menuitem"
                  type="button"
                >
                  {playlist.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

TrackLibraryActions.propTypes = {
  className: PropTypes.string,
  isLiked: PropTypes.bool,
  isLikeLoading: PropTypes.bool,
  onToggleLike: PropTypes.func,
  toast: PropTypes.func,
  trackId: PropTypes.string,
};
