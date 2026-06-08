const DEFAULT_GATEWAY_URL = "https://api.migueleelg0106.me";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

export function getGatewayBaseUrl(): string {
  return trimTrailingSlashes(import.meta.env.VITE_GATEWAY_URL || DEFAULT_GATEWAY_URL);
}

export function getMediaAssetUrl(assetId: string): string {
  const normalizedAssetId = assetId.trim();

  if (!normalizedAssetId) {
    throw new Error("assetId is required.");
  }

  return `${getGatewayBaseUrl()}/api/v1/media/assets/${encodeURIComponent(normalizedAssetId)}`;
}
