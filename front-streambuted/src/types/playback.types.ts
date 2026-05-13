export interface StreamSessionResponse {
  streamUrl: string;
  expiresAt: string;
  trackId: string;
}

export interface PlaybackProgressResponse {
  trackId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  updatedAt: string | null;
}

export interface LatestPlaybackProgressResponse {
  trackId: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  updatedAt: string | null;
}

export interface PlaybackProgressRequest {
  positionSeconds: number;
  durationSeconds: number | null;
  isPlaying?: boolean | null;
}
