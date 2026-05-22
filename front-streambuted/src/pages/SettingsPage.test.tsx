import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  getUploadFileHelperText: jest.fn((example: string) => `Ejemplo: ${example}.`),
  getUploadFileNameError: jest.fn(() => ""),
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

    await user.click(screen.getByRole("button", { name: "Activar modo artista" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Activar modo" }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });

    expect(
      await screen.findByText(
        "Tu perfil de artista aún se está preparando. Reintenta en unos segundos."
      )
    ).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("syncs the public artist profile after the artist profile becomes available", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const toast = jest.fn();
    const reloadSpy = jest.fn();

    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "listener-1",
      displayName: "listener",
    } as never);

    render(<SettingsPage user={listenerUser} toast={toast} reloadPage={reloadSpy} />);

    await user.click(screen.getByRole("button", { name: "Activar modo artista" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Activar modo" }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(700);
    });

    await waitFor(() => expect(catalogService.updateArtist).toHaveBeenCalledWith("listener-1", {
      displayName: "listener",
      biography: null,
      profileImageAssetId: null,
    }));
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Modo artista activado");
  });
  it("validates the profile form before opening the confirmation dialog", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<SettingsPage user={listenerUser} toast={jest.fn()} />);

    const usernameInput = screen.getByLabelText("Nombre de usuario");
    await user.clear(usernameInput);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son obligatorios.");

    await user.type(usernameInput, "ab");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El nombre de usuario debe tener entre 3 y 50 caracteres."
    );
  });

  it("requests logout from settings", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onRequestLogout = jest.fn();

    render(
      <SettingsPage
        user={listenerUser}
        toast={jest.fn()}
        onRequestLogout={onRequestLogout}
      />
    );

    await user.click(screen.getByRole("button", { name: /Cerrar/ }));

    expect(onRequestLogout).toHaveBeenCalledTimes(1);
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
      "Formato de imagen inválido. Usa JPG, PNG o WEBP."
    );

    const hugePng = new File(["png"], "avatar.png", { type: "image/png" });
    Object.defineProperty(hugePng, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(fileInput, {
      target: {
        files: [hugePng],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La imagen supera el máximo de 5 MB."
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
    const usernameInput = screen.getByLabelText("Nombre de usuario");
    const bioInput = screen.getByLabelText("Biografía");

    await user.clear(usernameInput);
    await user.type(usernameInput, "artist-renamed");
    await user.clear(bioInput);
    await user.type(bioInput, "Nueva bio");
    await user.upload(fileInput, new File(["png"], "avatar.png", { type: "image/png" }));

    expect(await screen.findByAltText("Previsualización de foto de perfil de listener")).toHaveAttribute(
      "src",
      "blob:profile-preview"
    );

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

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

    await user.clear(screen.getByLabelText("Nombre de usuario"));
    await user.type(screen.getByLabelText("Nombre de usuario"), "artist-renamed");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Perfil actualizado, pero no se pudo actualizar tu perfil público de artista. Intenta guardar de nuevo."
    );
    expect(toast).toHaveBeenCalledWith(
      "Perfil actualizado, pero no se pudo actualizar tu perfil público de artista. Intenta guardar de nuevo."
    );
    consoleErrorSpy.mockRestore();
  });
});
