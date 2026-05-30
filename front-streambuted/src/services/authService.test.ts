import { apiRequest, buildApiUrl } from "./apiClient";
import { authService } from "./authService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
  buildApiUrl: jest.fn((path: string) => `http://localhost/api/v1${path}`),
}));

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as Window & { streambuted?: unknown }).streambuted;
  });

  it("routes browser auth flows to the expected endpoints", async () => {
    jest.mocked(apiRequest).mockResolvedValue(undefined as never);

    await authService.login({ email: "listener@example.com", password: "SecurePass1!" });
    await authService.register({
      email: "listener@example.com",
      username: "listener",
      password: "SecurePass1!",
    });
    await authService.verifyRegistration({
      attemptId: "attempt-1",
      email: "listener@example.com",
      code: "123456",
    });
    await authService.resendRegistrationCode({
      attemptId: "attempt-1",
      email: "listener@example.com",
    });
    await authService.cancelRegistration({
      attemptId: "attempt-1",
      email: "listener@example.com",
    });
    await authService.setupPassword({
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    await authService.startPasswordReset({
      email: "listener@example.com",
    });
    await authService.resendPasswordResetCode({
      attemptId: "attempt-1",
      email: "listener@example.com",
    });
    await authService.verifyPasswordResetCode({
      attemptId: "attempt-1",
      email: "listener@example.com",
      code: "123456",
    });
    await authService.completePasswordReset({
      attemptId: "attempt-1",
      email: "listener@example.com",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    await authService.refresh();
    await authService.logout();
    await authService.createDesktopHandoffCode({
      state: "desktop-state",
      redirectUri: "streambuted://auth/callback",
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/auth/login", {
      method: "POST",
      body: { email: "listener@example.com", password: "SecurePass1!" },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/auth/register", {
      method: "POST",
      body: {
        email: "listener@example.com",
        username: "listener",
        password: "SecurePass1!",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/auth/register/verify", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
        code: "123456",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(4, "/auth/register/resend", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(5, "/auth/register/cancel", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(6, "/auth/password/setup", {
      method: "POST",
      body: {
        password: "SecurePass1!",
        confirmPassword: "SecurePass1!",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(7, "/auth/password/reset", {
      method: "POST",
      body: {
        email: "listener@example.com",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(8, "/auth/password/reset/resend", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(9, "/auth/password/reset/verify", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
        code: "123456",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(10, "/auth/password/reset/complete", {
      method: "POST",
      body: {
        attemptId: "attempt-1",
        email: "listener@example.com",
        password: "SecurePass1!",
        confirmPassword: "SecurePass1!",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(11, "/auth/refresh", {
      method: "POST",
    });
    expect(apiRequest).toHaveBeenNthCalledWith(12, "/auth/logout", {
      method: "POST",
    });
    expect(apiRequest).toHaveBeenNthCalledWith(13, "/auth/desktop/handoff-codes", {
      method: "POST",
      body: {
        state: "desktop-state",
        redirectUri: "streambuted://auth/callback",
      },
    });
  });

  it("builds Google auth urls through the api client helper", () => {
    expect(authService.getGoogleAuthUrl("login")).toBe(
      "http://localhost/api/v1/auth/google?mode=login"
    );
    expect(authService.getGoogleAuthUrl("register")).toBe(
      "http://localhost/api/v1/auth/google?mode=register"
    );
    expect(buildApiUrl).toHaveBeenCalledWith("/auth/google?mode=login");
    expect(buildApiUrl).toHaveBeenCalledWith("/auth/google?mode=register");
  });

  it("uses the Electron bridge for login, refresh, and logout when available", async () => {
    const desktopAuth: NonNullable<NonNullable<Window["streambuted"]>["auth"]> = {
      login: jest.fn().mockResolvedValue({ accessToken: "desktop-login-token" }),
      refresh: jest.fn().mockResolvedValue({ accessToken: "desktop-refresh-token" }),
      logout: jest.fn().mockResolvedValue(undefined),
      startGoogleOAuth: jest.fn().mockResolvedValue(undefined),
      onOAuthResult: jest.fn(() => () => {}),
      onOAuthError: jest.fn(() => () => {}),
    };

    window.streambuted = {
      isElectron: true,
      platform: "win32",
      auth: desktopAuth,
      versions: {
        chrome: "1",
        electron: "1",
        node: "1",
      },
    };

    await expect(
      authService.login({ email: "listener@example.com", password: "SecurePass1!" })
    ).resolves.toEqual({ accessToken: "desktop-login-token" });
    await expect(authService.refresh()).resolves.toEqual({ accessToken: "desktop-refresh-token" });
    await expect(authService.logout()).resolves.toBeUndefined();

    expect(desktopAuth.login).toHaveBeenCalledWith({
      email: "listener@example.com",
      password: "SecurePass1!",
    });
    expect(desktopAuth.refresh).toHaveBeenCalledTimes(1);
    expect(desktopAuth.logout).toHaveBeenCalledTimes(1);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
