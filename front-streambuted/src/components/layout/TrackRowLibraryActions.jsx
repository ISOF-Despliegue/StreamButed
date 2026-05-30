import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { TrackLibraryActions } from './TrackLibraryActions';
import { emitLikedSongsChanged, subscribeToLibraryEvents } from '../../services/libraryEvents';
import { libraryService } from '../../services/libraryService';
import { browserLogger } from '../../utils/browserLogger';
import { toUserFacingMessage } from '../../utils/userFacingMessages';

export function TrackRowLibraryActions({ className = '', toast = undefined, trackId }) {
  const [likeState, setLikeState] = useState({
    isLiked: false,
    isLoading: false,
  });

  const loadLikeStatus = useCallback(async ({ silent = false } = {}) => {
    if (!trackId) {
      setLikeState({ isLiked: false, isLoading: false });
      return;
    }

    if (typeof libraryService.getTrackLikeStatus !== 'function') {
      setLikeState({ isLiked: false, isLoading: false });
      return;
    }

    if (!silent) {
      setLikeState((current) => ({ ...current, isLoading: true }));
    }

    try {
      const status = await libraryService.getTrackLikeStatus(trackId);
      setLikeState({
        isLiked: status.isLiked,
        isLoading: false,
      });
    } catch (error) {
      browserLogger.warn(`Failed to load like status for track ${trackId}.`, error);
      setLikeState({
        isLiked: false,
        isLoading: false,
      });
    }
  }, [trackId]);

  useEffect(() => {
    void loadLikeStatus();
  }, [loadLikeStatus]);

  useEffect(() => (
    subscribeToLibraryEvents((event) => {
      if (event.type === 'liked-songs-changed') {
        void loadLikeStatus({ silent: true });
      }
    })
  ), [loadLikeStatus]);

  const toggleLike = useCallback(async () => {
    if (!trackId || likeState.isLoading) {
      return;
    }

    setLikeState((current) => ({ ...current, isLoading: true }));

    try {
      if (
        typeof libraryService.likeTrack !== 'function' ||
        typeof libraryService.unlikeTrack !== 'function'
      ) {
        setLikeState((current) => ({ ...current, isLoading: false }));
        return;
      }

      const status = likeState.isLiked
        ? await libraryService.unlikeTrack(trackId)
        : await libraryService.likeTrack(trackId);
      setLikeState({
        isLiked: status.isLiked,
        isLoading: false,
      });
      emitLikedSongsChanged();
      toast?.(status.isLiked ? 'Agregada a tus me gusta' : 'Quitada de tus me gusta');
    } catch (error) {
      browserLogger.error(`Failed to toggle like for track ${trackId}.`, error);
      setLikeState((current) => ({ ...current, isLoading: false }));
      toast?.(
        toUserFacingMessage(error instanceof Error ? error.message : 'No se pudo actualizar me gusta.')
      );
    }
  }, [likeState.isLiked, likeState.isLoading, toast, trackId]);

  return (
    <TrackLibraryActions
      className={className}
      trackId={trackId}
      isLiked={likeState.isLiked}
      isLikeLoading={likeState.isLoading}
      onToggleLike={toggleLike}
      toast={toast}
    />
  );
}

TrackRowLibraryActions.propTypes = {
  className: PropTypes.string,
  toast: PropTypes.func,
  trackId: PropTypes.string,
};
