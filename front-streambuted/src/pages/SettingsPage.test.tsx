import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./SettingsPage";
import { useAuth } from "../hooks/useAuth";
import { catalogService } from "../services/catalogService";

jest.mock("../hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../services/catalogService", () => ({
  catalogService: {
    getArtist: jest.fn(),
    updateArtist: jest.fn(),
  },
}));

jest.mock("../services/mediaService", () => ({
  getAssetUrl: jest.fn((assetId: string) => `http://localhost/api/v1/media/assets/${assetId}`),
  mediaService: {
    uploadProfileImage: jest.fn(),
  },
}));

const listenerUser = {
  id: "listener-1",
  email: "listener@example.com",
  username: "listener",
  bio: null,
  profileImageAssetId: null,
  role: "listener" as const,
  isActive: true,
  passwordSetupRequired: false,
  createdAt: "2026-05-06T00:00:00Z",
};

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(useAuth).mockReturnValue({
      user: listenerUser,
      accessToken: "token",
      isAuthenticated: true,
      isLoadingSession: false,
      login: jest.fn(),
      startRegistration: jest.fn(),
      verifyRegistration: jest.fn(),
      resendRegistrationCode: jest.fn(),
      cancelRegistration: jest.fn(),
      completeGooglePasswordSetup: jest.fn(),
      refreshSession: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      promoteToArtist: jest.fn().mockResolvedValue({
        ...listenerUser,
        role: "artist",
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("keeps the user on settings when catalog still has not created the artist profile", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const toast = jest.fn();
    const reloadSpy = jest.fn();

    jest.mocked(catalogService.getArtist).mockRejectedValue(new Error("Not ready"));

    render(<SettingsPage user={listenerUser} toast={toast} reloadPage={reloadSpy} />);

    await user.click(screen.getByRole("button", { name: "Start artist mode" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Activar modo" }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });

    expect(
      await screen.findByText(
        "Catalog aun esta preparando tu perfil. Reintenta desde el dashboard en unos segundos."
      )
    ).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reloads after the artist profile becomes available", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const toast = jest.fn();
    const reloadSpy = jest.fn();

    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "listener-1",
      displayName: "listener",
    } as never);

    render(<SettingsPage user={listenerUser} toast={toast} reloadPage={reloadSpy} />);

    await user.click(screen.getByRole("button", { name: "Start artist mode" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Activar modo" }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(700);
    });

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith("Modo artista activado");
  });
});
