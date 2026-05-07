import { apiRequest } from "./apiClient";
import type { UpdateProfileRequest } from "../types/auth.types";
import type { CurrentUser, UserRole } from "../types/user.types";

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
};
