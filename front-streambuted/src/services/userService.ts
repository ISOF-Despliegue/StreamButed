import { apiRequest } from "./apiClient";
import type { UpdateProfileRequest } from "../types/auth.types";
import type {
  AdminUser,
  AdminUserListResponse,
  BanUserRequest,
  CurrentUser,
  UserRole,
} from "../types/user.types";
import { withQuery } from "../utils/url";

function normalizeRole(role: string): UserRole {
  const normalized = role.toLowerCase();
  if (normalized === "admin" || normalized === "artist" || normalized === "listener") {
    return normalized;
  }

  return "listener";
}

function normalizeUser(user: CurrentUser & { role: string }): CurrentUser {
  return {
    ...user,
    bio: user.bio ?? null,
    profileImageAssetId: user.profileImageAssetId ?? null,
    passwordSetupRequired: Boolean(user.passwordSetupRequired),
    role: normalizeRole(user.role),
  };
}

export const userService = {
  async getCurrentUser(): Promise<CurrentUser> {
    const user = await apiRequest<CurrentUser & { role: string }>("/users/me");
    return normalizeUser(user);
  },

  async updateProfile(request: UpdateProfileRequest): Promise<CurrentUser> {
    const user = await apiRequest<CurrentUser & { role: string }>("/users/me", {
      method: "PUT",
      body: request,
    });
    return normalizeUser(user);
  },

  async promoteToArtist(): Promise<CurrentUser> {
    const user = await apiRequest<CurrentUser & { role: string }>("/users/promote", {
      method: "PATCH",
    });
    return normalizeUser(user);
  },

  listAdminUsers(params: { limit?: number; offset?: number; q?: string } = {}): Promise<AdminUserListResponse> {
    return apiRequest<AdminUserListResponse>(
      withQuery("/users/admin", {
        q: params.q,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      })
    );
  },

  banUser(userId: string, request: BanUserRequest): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/users/admin/${userId}/ban`, {
      method: "PATCH",
      body: request,
    });
  },

  unbanUser(userId: string): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/users/admin/${userId}/unban`, {
      method: "PATCH",
    });
  },
};
