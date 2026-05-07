export type MediaAssetType =
  | "PROFILE_IMAGE"
  | "AUDIO"
  | "TRACK_COVER"
  | "ALBUM_COVER";

export type CatalogImageUsage = "TRACK_COVER" | "ALBUM_COVER";

export interface AssetUploadResponse {
  assetId: string;
  assetType: MediaAssetType;
  contentType: string;
  sizeBytes: number;
}
