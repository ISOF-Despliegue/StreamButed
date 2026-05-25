export interface AnalyticsTrackMetric {
  trackId: string;
  title: string;
  artistId?: string | null;
  artistName?: string | null;
  plays: number;
  uniqueListeners: number;
}

export interface AnalyticsArtistMetric {
  artistId: string;
  artistName: string;
  plays: number;
  uniqueListeners: number;
}

export interface AnalyticsAlbumMetric {
  albumId: string;
  artistId: string;
  title: string;
  artistName?: string | null;
  coverAssetId?: string | null;
  plays: number;
}

export interface ArtistAnalyticsSummary {
  artistId: string;
  totalPlays: number;
  tracks: AnalyticsTrackMetric[];
  topTracks: AnalyticsTrackMetric[];
  averageDailyUniqueListeners: number;
  averageDailyPlays: number;
}

export interface AdminAnalyticsSummary {
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  totalPlays: number;
  topTracks: AnalyticsTrackMetric[];
  topArtists: AnalyticsArtistMetric[];
}

export interface PublicDiscoverySummary {
  topAlbums: AnalyticsAlbumMetric[];
  topArtists: AnalyticsArtistMetric[];
}
