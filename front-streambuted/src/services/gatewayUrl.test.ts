import { getMediaAssetUrl } from "./gatewayUrl";

describe("gatewayUrl", () => {
  it("normalizes and encodes media asset identifiers", () => {
    expect(getMediaAssetUrl(" live/cover ")).toBe(
      "https://api.migueleelg0106.me/api/v1/media/assets/live%2Fcover"
    );
  });

  it("rejects blank media asset identifiers", () => {
    expect(() => getMediaAssetUrl("   ")).toThrow("assetId is required.");
  });
});
