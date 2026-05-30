import { apiRequest, buildApiUrl } from "./apiClient";
import type {
  AuthResponse,
  DesktopHandoffCodeRequest,
  DesktopHandoffCodeResponse,
  LoginRequest,
  RegistrationVerificationActionRequest,
  RegistrationVerificationResponse,
  RegisterRequest,
  SetupPasswordRequest,
  VerifyRegistrationRequest,
} from "../types/auth.types";

function getDesktopAuth() {
  return window.streambuted?.isElectron ? window.streambuted.auth : undefined;
}

export const authService = {
  login(request: LoginRequest): Promise<AuthResponse> {
    const desktopAuth = getDesktopAuth();
    if (desktopAuth) {
      return desktopAuth.login(request);
    }

    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: request,
    });
  },

  register(request: RegisterRequest): Promise<RegistrationVerificationResponse> {
    return apiRequest<RegistrationVerificationResponse>("/auth/register", {
      method: "POST",
      body: request,
    });
  },

  verifyRegistration(request: VerifyRegistrationRequest): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/register/verify", {
      method: "POST",
      body: request,
    });
  },

  resendRegistrationCode(
    request: RegistrationVerificationActionRequest
  ): Promise<RegistrationVerificationResponse> {
    return apiRequest<RegistrationVerificationResponse>("/auth/register/resend", {
      method: "POST",
      body: request,
    });
  },

  cancelRegistration(request: RegistrationVerificationActionRequest): Promise<void> {
    return apiRequest<void>("/auth/register/cancel", {
      method: "POST",
      body: request,
    });
  },

  getGoogleAuthUrl(mode: "login" | "register"): string {
    return buildApiUrl(`/auth/google?mode=${mode}`);
  },

  setupPassword(request: SetupPasswordRequest): Promise<void> {
    return apiRequest<void>("/auth/password/setup", {
      method: "POST",
      body: request,
    });
  },

  refresh(): Promise<AuthResponse> {
    const desktopAuth = getDesktopAuth();
    if (desktopAuth) {
      return desktopAuth.refresh();
    }

    return apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
    });
  },

  logout(): Promise<void> {
    const desktopAuth = getDesktopAuth();
    if (desktopAuth) {
      return desktopAuth.logout();
    }

    return apiRequest<void>("/auth/logout", {
      method: "POST",
    });
  },

  createDesktopHandoffCode(request: DesktopHandoffCodeRequest): Promise<DesktopHandoffCodeResponse> {
    return apiRequest<DesktopHandoffCodeResponse>("/auth/desktop/handoff-codes", {
      method: "POST",
      body: request,
    });
  },
};
