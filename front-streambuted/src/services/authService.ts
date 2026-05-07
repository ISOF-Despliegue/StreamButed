import { apiRequest } from "./apiClient";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/auth.types";

export const authService = {
  login(request: LoginRequest): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: request,
    });
  },

  register(request: RegisterRequest): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: request,
    });
  },

  refresh(): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
    });
  },

  logout(): Promise<void> {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
    });
  },
};
