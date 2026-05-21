import { apiRequest } from "./apiClient";
import type {
  AdminAnalyticsSummary,
  ArtistAnalyticsSummary,
} from "../types/analytics.types";

export const analyticsService = {
  getArtistSummary(artistId: string): Promise<ArtistAnalyticsSummary> {
    return apiRequest<ArtistAnalyticsSummary>(`/analytics/artists/${artistId}/summary`);
  },

  getAdminSummary(): Promise<AdminAnalyticsSummary> {
    return apiRequest<AdminAnalyticsSummary>("/analytics/admin/summary");
  },
};
