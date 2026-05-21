import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AdminAnalyticsPage,
  AdminModerationPage,
  AdminOverviewPage,
} from "./AdminPages";
import { analyticsService } from "../../services/analyticsService";
import { catalogService } from "../../services/catalogService";
import { userService } from "../../services/userService";

jest.mock("../../services/analyticsService", () => ({
  analyticsService: {
    getAdminSummary: jest.fn(),
  },
}));

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    listAdminAlbums: jest.fn(),
    listAdminTracks: jest.fn(),
    retireAlbum: jest.fn(),
    retireTrack: jest.fn(),
  },
}));

jest.mock("../../services/userService", () => ({
  userService: {
    banUser: jest.fn(),
    listAdminUsers: jest.fn(),
    unbanUser: jest.fn(),
  },
}));

const pagination = {
  dataCount: 1,
  limit: 50,
  offset: 0,
  total: 1,
};

const summary = {
  dailyActiveUsers: 8,
  monthlyActiveUsers: 42,
  totalPlays: 1200,
  topTracks: [
    {
      trackId: "track-1",
      title: "Luna",
      plays: 10,
      uniqueListeners: 7,
    },
  ],
  topArtists: [
    {
      artistId: "artist-1",
      artistName: "Ada",
      plays: 12,
      uniqueListeners: 8,
    },
  ],
};

const trackResponse = {
  data: [
    {
      trackId: "track-1",
      title: "Luna",
      genre: "Rock",
      artistName: "Ada",
      albumTitle: null,
      status: "PUBLICADO",
      createdAt: "2026-05-20T12:00:00Z",
    },
  ],
  pagination,
};

const albumResponse = {
  data: [
    {
      albumId: "album-1",
      title: "Noches",
      artistName: "Ada",
      trackCount: 3,
      status: "PUBLICADO",
      createdAt: "2026-05-20T12:00:00Z",
    },
  ],
  pagination,
};

const usersResponse = {
  data: [
    {
      id: "admin-1",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      isActive: true,
      banStatus: "ACTIVE",
      bannedUntil: null,
      createdAt: "2026-05-20T12:00:00Z",
    },
    {
      id: "user-1",
      username: "listener",
      email: "listener@example.com",
      role: "listener",
      isActive: true,
      banStatus: "ACTIVE",
      bannedUntil: null,
      createdAt: "2026-05-20T12:00:00Z",
    },
    {
      id: "user-2",
      username: "artist",
      email: "artist@example.com",
      role: "artist",
      isActive: false,
      banStatus: "TEMPORARY",
      bannedUntil: "2026-05-22T12:00:00Z",
      createdAt: "2026-05-20T12:00:00Z",
    },
  ],
  pagination: {
    ...pagination,
    dataCount: 3,
    total: 3,
  },
};

describe("AdminPages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(analyticsService.getAdminSummary).mockResolvedValue(summary);
    jest.mocked(catalogService.listAdminTracks).mockResolvedValue(trackResponse);
    jest.mocked(catalogService.listAdminAlbums).mockResolvedValue(albumResponse);
    jest.mocked(catalogService.retireTrack).mockResolvedValue({});
    jest.mocked(catalogService.retireAlbum).mockResolvedValue({});
    jest.mocked(userService.listAdminUsers).mockResolvedValue(usersResponse);
    jest.mocked(userService.banUser).mockResolvedValue({});
    jest.mocked(userService.unbanUser).mockResolvedValue({});
  });

  it("renders global overview and analytics summaries", async () => {
    const { rerender } = render(<AdminOverviewPage />);

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();

    rerender(<AdminAnalyticsPage />);

    expect(await screen.findByText("Reproducciones globales")).toBeInTheDocument();
    expect(screen.getAllByText("Luna")).not.toHaveLength(0);
    expect(analyticsService.getAdminSummary).toHaveBeenCalledTimes(2);
  });

  it("loads tracks and retires a song through the in-app confirmation", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();

    render(<AdminModerationPage toast={toast} />);

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("Single")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/retirar "Luna"/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Retirar cancion" }));

    await waitFor(() => expect(catalogService.retireTrack).toHaveBeenCalledWith("track-1"));
    expect(toast).toHaveBeenCalledWith("Cancion retirada.");
  });

  it("loads albums and retires an album through the in-app confirmation", async () => {
    const user = userEvent.setup();

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Albumes" }));
    expect(await screen.findByText("Noches")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/retirar "Noches"/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Retirar album" }));

    await waitFor(() => expect(catalogService.retireAlbum).toHaveBeenCalledWith("album-1"));
  });

  it("loads accounts, bans a user, and reactivates a banned account", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();

    render(<AdminModerationPage toast={toast} />);

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    expect(await screen.findByText("listener@example.com")).toBeInTheDocument();
    expect(screen.getByText("Protegida")).toBeInTheDocument();
    expect(screen.getByText("Baneo temporal")).toBeInTheDocument();
    expect(screen.getAllByText("Sin baneo")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Banear" }));
    await user.selectOptions(screen.getByDisplayValue("Temporal"), "PERMANENT");
    await user.type(screen.getByPlaceholderText("Opcional"), "Uso indebido");
    await user.click(screen.getByRole("button", { name: "Confirmar baneo" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/permanentemente la cuenta listener/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Banear cuenta" }));

    await waitFor(() => expect(userService.banUser).toHaveBeenCalledWith("user-1", {
      banType: "PERMANENT",
      durationAmount: undefined,
      durationUnit: undefined,
      reason: "Uso indebido",
    }));
    expect(toast).toHaveBeenCalledWith("Cuenta baneada.");

    await user.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(userService.unbanUser).toHaveBeenCalledWith("user-2"));
  });

  it("normalizes temporary ban duration before confirming", async () => {
    const user = userEvent.setup();

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    await screen.findByText("listener@example.com");

    await user.click(screen.getByRole("button", { name: "Banear" }));
    await user.clear(screen.getByLabelText("Tiempo"));
    await user.click(screen.getByRole("button", { name: "Confirmar baneo" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/por 1 dias/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Banear cuenta" }));

    await waitFor(() => expect(userService.banUser).toHaveBeenCalledWith("user-1", expect.objectContaining({
      banType: "TEMPORARY",
      durationAmount: 1,
      durationUnit: "DAYS",
    })));
  });

  it("shows load errors and retries moderation data", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listAdminTracks)
      .mockRejectedValueOnce(new Error("Fallo de catalogo."))
      .mockResolvedValueOnce(trackResponse);

    render(<AdminModerationPage toast={jest.fn()} />);

    expect(await screen.findByText("Fallo de catalogo.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Luna")).toBeInTheDocument();
  });
});
