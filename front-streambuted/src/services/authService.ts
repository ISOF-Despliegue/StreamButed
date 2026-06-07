import { apiRequest, buildApiUrl } from "./apiClient";
import type {
  AuthResponse,
  CompletePasswordResetRequest,
  DesktopHandoffCodeRequest,
  DesktopHandoffCodeResponse,
  LoginRequest,
  PasswordResetActionRequest,
  RegistrationVerificationActionRequest,
  RegistrationVerificationResponse,
  RegisterRequest,
  SetupPasswordRequest,
  StartPasswordResetRequest,
  VerifyPasswordResetCodeRequest,
  VerifyRegistrationRequest,
} from "../types/auth.types";

function getDesktopAuth() {
  return globalThis.window.streambuted?.isElectron ? globalThis.window.streambuted.auth : undefined;
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

  startPasswordReset(request: StartPasswordResetRequest): Promise<RegistrationVerificationResponse> {
    return apiRequest<RegistrationVerificationResponse>("/auth/password/reset", {
      method: "POST",
      body: request,
    });
  },

  resendPasswordResetCode(request: PasswordResetActionRequest): Promise<RegistrationVerificationResponse> {
    return apiRequest<RegistrationVerificationResponse>("/auth/password/reset/resend", {
      method: "POST",
      body: request,
    });
  },

  verifyPasswordResetCode(request: VerifyPasswordResetCodeRequest): Promise<void> {
    return apiRequest<void>("/auth/password/reset/verify", {
      method: "POST",
      body: request,
    });
  },

  completePasswordReset(request: CompletePasswordResetRequest): Promise<void> {
    return apiRequest<void>("/auth/password/reset/complete", {
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
