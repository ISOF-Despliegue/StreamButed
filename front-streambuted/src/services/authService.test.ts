import { apiRequest, buildApiUrl } from "./apiClient";
import { authService } from "./authService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
  buildApiUrl: jest.fn((path: string) => `http://localhost/api/v1${path}`),
}));

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes email and verification auth flows to the expected endpoints", async () => {
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
    await authService.refresh();
    await authService.logout();

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
    expect(apiRequest).toHaveBeenNthCalledWith(7, "/auth/refresh", {
      method: "POST",
    });
    expect(apiRequest).toHaveBeenNthCalledWith(8, "/auth/logout", {
      method: "POST",
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
});
