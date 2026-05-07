import type { CurrentUser, UserRole } from "./user.types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string | null;
  role: UserRole | string;
  expiresIn: number;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  login: (request: LoginRequest) => Promise<CurrentUser>;
  register: (request: RegisterRequest) => Promise<CurrentUser>;
  refreshSession: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
  updateProfile: (request: UpdateProfileRequest) => Promise<CurrentUser>;
  promoteToArtist: () => Promise<CurrentUser>;
}

export interface UpdateProfileRequest {
  username?: string;
  bio?: string | null;
  profileImageAssetId?: string | null;
}
