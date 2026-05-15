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

export interface SetupPasswordRequest {
  password: string;
  confirmPassword: string;
}

export interface RegistrationVerificationResponse {
  attemptId: string;
  email: string;
  status: string;
  expiresInSeconds: number;
  message: string;
}

export interface VerifyRegistrationRequest {
  attemptId: string;
  email: string;
  code: string;
}

export interface RegistrationVerificationActionRequest {
  attemptId: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string | null;
  role: UserRole | Uppercase<UserRole>;
  expiresIn: number;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  login: (request: LoginRequest) => Promise<CurrentUser>;
  startRegistration: (request: RegisterRequest) => Promise<RegistrationVerificationResponse>;
  verifyRegistration: (request: VerifyRegistrationRequest) => Promise<CurrentUser>;
  resendRegistrationCode: (
    request: RegistrationVerificationActionRequest
  ) => Promise<RegistrationVerificationResponse>;
  cancelRegistration: (request: RegistrationVerificationActionRequest) => Promise<void>;
  completeGooglePasswordSetup: (request: SetupPasswordRequest) => Promise<CurrentUser>;
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
