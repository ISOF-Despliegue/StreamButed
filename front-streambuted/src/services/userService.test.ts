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

  it("calls admin moderation endpoints", async () => {
    jest.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [], pagination: { total: 0 } } as never)
      .mockResolvedValueOnce({ id: "user-1" } as never)
      .mockResolvedValueOnce({ id: "user-1" } as never);

    await userService.listAdminUsers({ limit: 25, offset: 50 });
    await userService.banUser("user-1", {
      banType: "TEMPORARY",
      durationAmount: 7,
      durationUnit: "DAYS",
      reason: "Abuse",
    });
    await userService.unbanUser("user-1");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/users/admin?limit=25&offset=50");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/users/admin/user-1/ban", {
      method: "PATCH",
      body: {
        banType: "TEMPORARY",
        durationAmount: 7,
        durationUnit: "DAYS",
        reason: "Abuse",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/users/admin/user-1/unban", {
      method: "PATCH",
    });
  });
});
