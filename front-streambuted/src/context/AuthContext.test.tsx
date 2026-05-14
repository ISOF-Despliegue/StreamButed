import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";
import { authTokenStore } from "../services/authTokenStore";
import { authService } from "../services/authService";
import { userService } from "../services/userService";

jest.mock("../services/authService", () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    verifyRegistration: jest.fn(),
    resendRegistrationCode: jest.fn(),
    cancelRegistration: jest.fn(),
    setupPassword: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock("../services/userService", () => ({
  userService: {
    getCurrentUser: jest.fn(),
    updateProfile: jest.fn(),
    promoteToArtist: jest.fn(),
  },
}));

const currentUser = {
  id: "user-1",
  email: "listener@example.com",
  username: "listener",
  bio: null,
  profileImageAssetId: null,
  role: "listener" as const,
  isActive: true,
  passwordSetupRequired: false,
  createdAt: "2026-05-06T00:00:00Z",
};

function LoginHarness() {
  const {
    user,
    login,
    startRegistration,
    verifyRegistration,
    resendRegistrationCode,
    cancelRegistration,
    completeGooglePasswordSetup,
    logout,
    updateProfile,
    promoteToArtist,
    refreshSession,
    isLoadingSession,
    isAuthenticated,
    accessToken,
  } = useAuth();

  if (isLoadingSession) return <div>loading</div>;

  return (
    <div>
      <div>{user?.username ?? "anonymous"}</div>
      <div>{user?.role ?? "no-role"}</div>
      <div>{accessToken ?? "no-token"}</div>
      <div>{isAuthenticated ? "authenticated" : "anonymous-session"}</div>
      <button onClick={() => login({ email: "listener@example.com", password: "SecurePass1!" })}>
        login
      </button>
      <button
        onClick={() =>
          startRegistration({
            email: "pending@example.com",
            username: "pending-user",
            password: "SecurePass1!",
          })
        }
      >
        start-registration
      </button>
      <button
        onClick={() =>
          verifyRegistration({
            attemptId: "attempt-1",
            email: "pending@example.com",
            code: "123456",
          })
        }
      >
        verify-registration
      </button>
      <button
        onClick={() =>
          resendRegistrationCode({
            attemptId: "attempt-1",
            email: "pending@example.com",
          })
        }
      >
        resend-code
      </button>
      <button
        onClick={() =>
          cancelRegistration({
            attemptId: "attempt-1",
            email: "pending@example.com",
          })
        }
      >
        cancel-registration
      </button>
      <button
        onClick={() =>
          completeGooglePasswordSetup({
            password: "SecurePass1!",
            confirmPassword: "SecurePass1!",
          })
        }
      >
        complete-google-password
      </button>
      <button onClick={() => logout()}>logout</button>
      <button
        onClick={() =>
          updateProfile({
            username: "listener-updated",
            bio: "updated bio",
            profileImageAssetId: "asset-1",
          })
        }
      >
        update-profile
      </button>
      <button onClick={() => refreshSession()}>refresh-session</button>
      <button onClick={() => promoteToArtist()}>promote</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    authTokenStore.clear();
    jest.mocked(authService.refresh).mockRejectedValue(new Error("No refresh"));
    jest.mocked(authService.login).mockResolvedValue({
      accessToken: "access-token",
      role: "listener",
      expiresIn: 900,
    });
    jest.mocked(authService.register).mockResolvedValue({
      attemptId: "attempt-1",
      email: "pending@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent.",
    });
    jest.mocked(authService.verifyRegistration).mockResolvedValue({
      accessToken: "verified-token",
      role: "listener",
      expiresIn: 900,
    });
    jest.mocked(authService.resendRegistrationCode).mockResolvedValue({
      attemptId: "attempt-2",
      email: "pending@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent again.",
    });
    jest.mocked(authService.cancelRegistration).mockResolvedValue(undefined);
    jest.mocked(authService.setupPassword).mockResolvedValue(undefined);
    jest.mocked(authService.logout).mockResolvedValue(undefined);
    jest.mocked(userService.getCurrentUser).mockResolvedValue(currentUser);
    jest.mocked(userService.updateProfile).mockResolvedValue({
      ...currentUser,
      username: "listener-updated",
      bio: "updated bio",
      profileImageAssetId: "asset-1",
    });
    jest.mocked(userService.promoteToArtist).mockResolvedValue({
      ...currentUser,
      role: "artist",
    });
  });

  it("stores access token in memory after login", async () => {
    const user = userEvent.setup();
    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByText("access-token")).toBeInTheDocument());
    expect(authTokenStore.getAccessToken()).toBe("access-token");
  });

  it("refreshes the access token after promoting to artist", async () => {
    const user = userEvent.setup();
    jest.mocked(authService.refresh)
      .mockRejectedValueOnce(new Error("No refresh"))
      .mockResolvedValueOnce({
        accessToken: "artist-token",
        role: "artist",
        expiresIn: 900,
      });
    jest.mocked(userService.getCurrentUser)
      .mockResolvedValueOnce(currentUser)
      .mockResolvedValueOnce({
        ...currentUser,
        role: "artist",
      });

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "promote" }));

    await waitFor(() => expect(authTokenStore.getAccessToken()).toBe("artist-token"));
    expect(screen.getByText("artist-token")).toBeInTheDocument();
    expect(userService.promoteToArtist).toHaveBeenCalledTimes(1);
    expect(jest.mocked(authService.refresh).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(jest.mocked(userService.getCurrentUser).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("refreshes the session on mount when a refresh token exists", async () => {
    jest.mocked(authService.refresh).mockResolvedValueOnce({
      accessToken: "refreshed-token",
      role: "listener",
      expiresIn: 900,
    });

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    expect(await screen.findByText("listener")).toBeInTheDocument();
    expect(screen.getByText("refreshed-token")).toBeInTheDocument();
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });

  it("delegates registration verification actions to the auth service", async () => {
    const user = userEvent.setup();
    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "start-registration" }));
    await user.click(screen.getByRole("button", { name: "resend-code" }));
    await user.click(screen.getByRole("button", { name: "cancel-registration" }));

    expect(authService.register).toHaveBeenCalledWith({
      email: "pending@example.com",
      username: "pending-user",
      password: "SecurePass1!",
    });
    expect(authService.resendRegistrationCode).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "pending@example.com",
    });
    expect(authService.cancelRegistration).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "pending@example.com",
    });
  });

  it("commits the verified session after registration code validation", async () => {
    const user = userEvent.setup();

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "verify-registration" }));

    await waitFor(() => expect(screen.getByText("verified-token")).toBeInTheDocument());
    expect(authService.verifyRegistration).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "pending@example.com",
      code: "123456",
    });
  });

  it("updates the user after setting a Google password", async () => {
    const user = userEvent.setup();
    const googleUser = {
      ...currentUser,
      username: "google-user",
      passwordSetupRequired: false,
    };

    jest.mocked(userService.getCurrentUser).mockResolvedValueOnce(googleUser);

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "complete-google-password" }));

    await waitFor(() => expect(screen.getByText("google-user")).toBeInTheDocument());
    expect(authService.setupPassword).toHaveBeenCalledWith({
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
  });

  it("updates the in-memory user profile", async () => {
    const user = userEvent.setup();

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "update-profile" }));

    await waitFor(() => expect(screen.getByText("listener-updated")).toBeInTheDocument());
    expect(userService.updateProfile).toHaveBeenCalledWith({
      username: "listener-updated",
      bio: "updated bio",
      profileImageAssetId: "asset-1",
    });
  });

  it("clears the session after logout", async () => {
    const user = userEvent.setup();

    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(screen.getByText("access-token")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(screen.getByText("no-token")).toBeInTheDocument();
  });
});
