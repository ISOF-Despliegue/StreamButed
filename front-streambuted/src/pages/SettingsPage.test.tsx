import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./SettingsPage";
import { useAuth } from "../hooks/useAuth";
import { catalogService } from "../services/catalogService";
import { mediaService } from "../services/mediaService";

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

const artistUser = {
  ...listenerUser,
  role: "artist" as const,
  profileImageAssetId: "profile-asset-1",
  bio: "Mi bio actual",
};

function mockAuth(overrides = {}) {
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
    ...overrides,
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuth();
    jest.mocked(mediaService.uploadProfileImage).mockResolvedValue({
      assetId: "uploaded-profile-asset",
    } as never);
    jest.mocked(catalogService.updateArtist).mockResolvedValue(undefined as never);
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
  it("validates the profile form before opening the confirmation dialog", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<SettingsPage user={listenerUser} toast={jest.fn()} />);

    const usernameInput = screen.getByLabelText("Username");
    await user.clear(usernameInput);
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Username requerido.");

    await user.type(usernameInput, "ab");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Username debe tener entre 3 y 50 caracteres."
    );
  });

  it("rejects invalid and oversized profile images", async () => {
    const { container } = render(<SettingsPage user={listenerUser} toast={jest.fn()} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["gif"], "avatar.gif", { type: "image/gif" })],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Formato de imagen invalido. Usa JPG, PNG o WEBP."
    );

    const hugePng = new File(["png"], "avatar.png", { type: "image/png" });
    Object.defineProperty(hugePng, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(fileInput, {
      target: {
        files: [hugePng],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La imagen supera el maximo de 5 MB."
    );
  });

  it("updates an artist profile and syncs the public catalog profile", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const updateProfile = jest.fn().mockResolvedValue({
      ...artistUser,
      username: "artist-renamed",
      bio: "Nueva bio",
      profileImageAssetId: "uploaded-profile-asset",
    });
    const toast = jest.fn();

    mockAuth({ user: artistUser, updateProfile });
    const createObjectURL = jest.fn(() => "blob:profile-preview");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: revokeObjectURL,
    });

    const { container, unmount } = render(<SettingsPage user={artistUser} toast={toast} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const usernameInput = screen.getByLabelText("Username");
    const bioInput = screen.getByLabelText("Bio");

    await user.clear(usernameInput);
    await user.type(usernameInput, "artist-renamed");
    await user.clear(bioInput);
    await user.type(bioInput, "Nueva bio");
    await user.upload(fileInput, new File(["png"], "avatar.png", { type: "image/png" }));

    expect(await screen.findByAltText("Previsualizacion de foto de perfil de listener")).toHaveAttribute(
      "src",
      "blob:profile-preview"
    );

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(await screen.findByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(mediaService.uploadProfileImage).toHaveBeenCalledWith(expect.any(File));
      expect(updateProfile).toHaveBeenCalledWith({
        username: "artist-renamed",
        bio: "Nueva bio",
        profileImageAssetId: "uploaded-profile-asset",
      });
      expect(catalogService.updateArtist).toHaveBeenCalledWith("listener-1", {
        displayName: "artist-renamed",
        biography: "Nueva bio",
        profileImageAssetId: "uploaded-profile-asset",
      });
    });

    expect(toast).toHaveBeenCalledWith("Perfil actualizado");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:profile-preview");
  });

  it("surfaces catalog sync errors after identity profile update", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const updateProfile = jest.fn().mockResolvedValue({
      ...artistUser,
      username: "artist-renamed",
    });
    const toast = jest.fn();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAuth({ user: artistUser, updateProfile });
    jest.mocked(catalogService.updateArtist).mockRejectedValueOnce(new Error("sync failed"));

    render(<SettingsPage user={artistUser} toast={toast} />);

    await user.clear(screen.getByLabelText("Username"));
    await user.type(screen.getByLabelText("Username"), "artist-renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(await screen.findByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Perfil actualizado en Identity, pero no se pudo sincronizar el perfil publico de artista. Intenta guardar de nuevo."
    );
    expect(toast).toHaveBeenCalledWith(
      "Perfil actualizado en Identity, pero no se pudo sincronizar el perfil publico de artista. Intenta guardar de nuevo."
    );
    consoleErrorSpy.mockRestore();
  });
});
