import { useEffect, useRef, useState } from 'react';
import { IcMusic, IcHeart, IcPlus, IcShuffle, IcSkipBack, IcPlay, IcPause, IcSkipFwd, IcRepeat, IcVolume } from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { libraryService } from '../../services/libraryService';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDuration } from '../../utils/formatters';
import { toUserFacingMessage } from '../../utils/userFacingMessages';
import PropTypes from 'prop-types';

export function BottomPlayer({
  track,
  onExpand,
  volume,
  setVolume,
  playback,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  onToggleShuffle,
  onToggleRepeat,
  isLiked = false,
  isLikeLoading = false,
  onToggleLike = undefined,
  toast = undefined
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

  const trackId = track?.trackId || track?.id;

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

  if (!track) return (
    <div className="bottom-player">
      <div className="player-track" style={{ color: 'var(--t3)', fontSize: 13 }}>
        <div className="player-cover"><IcMusic /></div>
        <span>Selecciona una pista del catálogo.</span>
      </div>
    </div>
  );

  const artistName = track.artist || track.artistName || 'Artista';
  const progressMax = playback.durationSeconds > 0 ? playback.durationSeconds : 1;
  const playTitle = playback.isPlaying ? 'Pausar' : 'Reproducir';
  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

    setVolume(Math.round(pct * 100));
  };

  return (
    <div className="bottom-player">
      <div className="player-track">
        <button
          aria-label="Abrir reproductor expandido"
          className="player-cover"
          onClick={onExpand}
          type="button"
        >
          {track.coverAssetId ? (
            <img src={getAssetUrl(track.coverAssetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20 }}><IcMusic /></div>
          )}
        </button>
        <div className="player-track-info">
          <button className="player-track-name" onClick={onExpand} type="button">
            {track.title}
          </button>
          <div className="player-track-artist">{artistName}</div>
        </div>
        <button
          aria-label={isLiked ? 'Quitar de canciones que te gustan' : 'Guardar en canciones que te gustan'}
          aria-pressed={isLiked}
          className={`btn-icon${isLiked ? ' active' : ''}`}
          disabled={isLikeLoading || !onToggleLike}
          onClick={onToggleLike}
          style={{ marginLeft: 8 }}
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
            style={{ marginLeft: 2 }}
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

      <div className="player-center">
        <div className="player-controls">
          <button
            className={`btn-icon${playback.shuffleEnabled ? ' active' : ''}`}
            disabled={!playback.canUseAlbumControls}
            title="Aleatorio del álbum"
            aria-pressed={playback.shuffleEnabled}
            onClick={onToggleShuffle}
          >
            <IcShuffle />
          </button>
          <button
            className="btn-icon"
            title="Pista anterior"
            onClick={onPrevious}
          >
            <IcSkipBack />
          </button>
          <button className="play-btn" disabled={playback.isLoading} title={playTitle} onClick={onTogglePlay}>
            {playback.isPlaying ? <IcPause /> : <IcPlay />}
          </button>
          <button
            className="btn-icon"
            title="Siguiente pista"
            onClick={onNext}
          >
            <IcSkipFwd />
          </button>
          <button
            className={`btn-icon${playback.repeatEnabled ? ' active' : ''}`}
            title="Repetir"
            aria-pressed={playback.repeatEnabled}
            onClick={onToggleRepeat}
          >
            <IcRepeat />
          </button>
        </div>
        <div className="player-progress">
          <span className="progress-time">{formatDuration(playback.positionSeconds)}</span>
          <ProgressBar value={playback.positionSeconds} max={progressMax} onChange={onSeek} />
          <span className="progress-time right">
            {playback.error ? 'Error' : formatDuration(playback.durationSeconds || null)}
          </span>
        </div>
      </div>

      <div className="player-right">
        <button className="btn-icon"><IcVolume /></button>
        <button
          aria-label="Cambiar volumen"
          className="volume-bar"
          onClick={handleVolumeClick}
          type="button"
        >
          <div className="volume-fill" style={{ width: `${volume}%` }} />
        </button>
      </div>
    </div>
  );
}

BottomPlayer.propTypes = {
  onExpand: PropTypes.func.isRequired,
  isLiked: PropTypes.bool,
  isLikeLoading: PropTypes.bool,
  onNext: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  onSeek: PropTypes.func.isRequired,
  onToggleLike: PropTypes.func,
  onTogglePlay: PropTypes.func.isRequired,
  onToggleRepeat: PropTypes.func.isRequired,
  onToggleShuffle: PropTypes.func.isRequired,
  playback: PropTypes.shape({
    canUseAlbumControls: PropTypes.bool,
    durationSeconds: PropTypes.number,
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    isPlaying: PropTypes.bool,
    positionSeconds: PropTypes.number,
    repeatEnabled: PropTypes.bool,
    shuffleEnabled: PropTypes.bool,
  }).isRequired,
  setVolume: PropTypes.func.isRequired,
  toast: PropTypes.func,
  track: PropTypes.shape({
    artist: PropTypes.string,
    artistName: PropTypes.string,
    coverAssetId: PropTypes.string,
    id: PropTypes.string,
    title: PropTypes.string,
    trackId: PropTypes.string,
  }),
  volume: PropTypes.number.isRequired,
};
