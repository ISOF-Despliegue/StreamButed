import { apiRequest } from "./apiClient";
import { userService } from "./userService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("userService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes current user payloads from the backend", async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({
      id: "user-1",
      email: "listener@example.com",
      username: "listener",
      bio: undefined,
      profileImageAssetId: undefined,
      role: "ADMIN",
      isActive: true,
      passwordSetupRequired: 1,
      createdAt: "2026-05-06T00:00:00Z",
    } as never);

    await expect(userService.getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "listener@example.com",
      username: "listener",
      bio: null,
      profileImageAssetId: null,
      role: "admin",
      isActive: true,
      passwordSetupRequired: true,
      createdAt: "2026-05-06T00:00:00Z",
    });

    expect(apiRequest).toHaveBeenCalledWith("/users/me");
  });

  it("normalizes updated and promoted users, defaulting unknown roles to listener", async () => {
    jest.mocked(apiRequest)
      .mockResolvedValueOnce({
        id: "user-1",
        email: "artist@example.com",
        username: "artist",
        bio: "Nueva bio",
        profileImageAssetId: "asset-1",
        role: "artist",
        isActive: true,
        passwordSetupRequired: false,
        createdAt: "2026-05-06T00:00:00Z",
      } as never)
      .mockResolvedValueOnce({
        id: "user-1",
        email: "mystery@example.com",
        username: "mystery",
        bio: null,
        profileImageAssetId: null,
        role: "SUPERUSER",
        isActive: true,
        passwordSetupRequired: false,
        createdAt: "2026-05-06T00:00:00Z",
      } as never);

    await expect(
      userService.updateProfile({
        username: "artist",
        bio: "Nueva bio",
        profileImageAssetId: "asset-1",
      })
    ).resolves.toMatchObject({
      role: "artist",
      bio: "Nueva bio",
      profileImageAssetId: "asset-1",
    });

    await expect(userService.promoteToArtist()).resolves.toMatchObject({
      role: "listener",
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/users/me", {
      method: "PUT",
      body: {
        username: "artist",
        bio: "Nueva bio",
        profileImageAssetId: "asset-1",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/users/promote", {
      method: "PATCH",
    });
  });
});
