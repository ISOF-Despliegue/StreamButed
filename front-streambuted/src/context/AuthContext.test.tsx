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
  createdAt: "2026-05-06T00:00:00Z",
};

function LoginHarness() {
  const { user, login, isLoadingSession } = useAuth();

  if (isLoadingSession) return <div>loading</div>;

  return (
    <div>
      <div>{user?.username ?? "anonymous"}</div>
      <button onClick={() => login({ email: "listener@example.com", password: "SecurePass1!" })}>
        login
      </button>
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
    jest.mocked(userService.getCurrentUser).mockResolvedValue(currentUser);
  });

  it("stores access token in memory after login", async () => {
    const user = userEvent.setup();
    render(<AuthProvider><LoginHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByText("listener")).toBeInTheDocument());
    expect(authTokenStore.getAccessToken()).toBe("access-token");
  });
});
