import { apiRequest } from "./apiClient";
import type {
  AdminAnalyticsSummary,
  ArtistAnalyticsSummary,
  PublicDiscoverySummary,
} from "../types/analytics.types";

export const analyticsService = {
  getArtistSummary(artistId: string): Promise<ArtistAnalyticsSummary> {
    return apiRequest<ArtistAnalyticsSummary>(`/analytics/artists/${artistId}/summary`);
  },

  getArtistPublicSummary(artistId: string): Promise<ArtistAnalyticsSummary> {
    return apiRequest<ArtistAnalyticsSummary>(`/analytics/artists/${artistId}/public-summary`);
  },

  getAdminSummary(): Promise<AdminAnalyticsSummary> {
    return apiRequest<AdminAnalyticsSummary>("/analytics/admin/summary");
  },

  getDiscoverySummary(): Promise<PublicDiscoverySummary> {
    return apiRequest<PublicDiscoverySummary>("/analytics/discovery/summary");
  },
};
