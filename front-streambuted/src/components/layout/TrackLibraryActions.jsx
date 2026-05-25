import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { IcHeart, IcPlus } from '../icons/Icons';
import { libraryService } from '../../services/libraryService';
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
      await libraryService.addTrackToPlaylist(playlistId, trackId);
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
