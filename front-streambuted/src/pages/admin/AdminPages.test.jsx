/* global beforeEach, describe, expect, it, jest */
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
    reinstateAlbum: jest.fn(),
    reinstateTrack: jest.fn(),
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
  limit: 10,
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
    jest.resetAllMocks();
    jest.mocked(analyticsService.getAdminSummary).mockResolvedValue(summary);
    jest.mocked(catalogService.listAdminTracks).mockResolvedValue(trackResponse);
    jest.mocked(catalogService.listAdminAlbums).mockResolvedValue(albumResponse);
    jest.mocked(catalogService.retireTrack).mockResolvedValue({});
    jest.mocked(catalogService.retireAlbum).mockResolvedValue({});
    jest.mocked(catalogService.reinstateTrack).mockResolvedValue({});
    jest.mocked(catalogService.reinstateAlbum).mockResolvedValue({});
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
    expect(screen.getByText("Sencillo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/retirar "Luna"/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Retirar canción" }));

    await waitFor(() => expect(catalogService.retireTrack).toHaveBeenCalledWith("track-1"));
    expect(toast).toHaveBeenCalledWith("Canción retirada.");
  });

  it("requests and renders only 10 moderation rows", async () => {
    const manyTracks = Array.from({ length: 10 }, (_, index) => ({
      trackId: `track-${index + 1}`,
      title: `Cancion ${index + 1}`,
      genre: "Rock",
      artistName: "Ada",
      albumTitle: null,
      status: "PUBLICADO",
      createdAt: "2026-05-20T12:00:00Z",
    }));
    jest.mocked(catalogService.listAdminTracks).mockResolvedValueOnce({
      data: manyTracks,
      pagination: {
        dataCount: 10,
        limit: 10,
        offset: 0,
        total: 12,
      },
    });

    render(<AdminModerationPage toast={jest.fn()} />);

    expect(await screen.findByText("Cancion 1")).toBeInTheDocument();
    expect(screen.getByText("Cancion 10")).toBeInTheDocument();
    expect(screen.queryByText("Cancion 11")).not.toBeInTheDocument();
    expect(catalogService.listAdminTracks).toHaveBeenCalledWith({
      includeRetired: true,
      limit: 10,
      offset: 0,
    });
  });

  it("searches songs through the backend instead of filtering the local list", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listAdminTracks).mockResolvedValueOnce({
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
        {
          trackId: "track-2",
          title: "Sol",
          genre: "Pop",
          artistName: "Beto",
          albumTitle: "Dia",
          status: "PUBLICADO",
          createdAt: "2026-05-20T12:00:00Z",
        },
      ],
      pagination: {
        dataCount: 2,
        limit: 10,
        offset: 0,
        total: 2,
      },
    }).mockResolvedValueOnce({
      data: [
        {
          trackId: "track-2",
          title: "Sol",
          genre: "Pop",
          artistName: "Beto",
          albumTitle: "Dia",
          status: "PUBLICADO",
          createdAt: "2026-05-20T12:00:00Z",
        },
      ],
      pagination: {
        dataCount: 1,
        limit: 10,
        offset: 0,
        total: 1,
      },
    });

    render(<AdminModerationPage toast={jest.fn()} />);

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar canciones"), "be{Enter}");

    expect(await screen.findByText("Sol")).toBeInTheDocument();
    expect(screen.queryByText("Luna")).not.toBeInTheDocument();
    expect(catalogService.listAdminTracks).toHaveBeenNthCalledWith(2, {
      includeRetired: true,
      limit: 10,
      offset: 0,
      q: "be",
    });
  });

  it("routes album searches to the album moderation endpoint", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listAdminAlbums).mockResolvedValueOnce(albumResponse)
      .mockResolvedValueOnce({
        data: [
          {
            albumId: "album-2",
            title: "Tardes",
            artistName: "Beto",
            trackCount: 4,
            status: "PUBLICADO",
            createdAt: "2026-05-20T12:00:00Z",
          },
        ],
        pagination: {
          ...pagination,
          dataCount: 1,
          total: 1,
        },
      });

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Álbumes" }));
    expect(await screen.findByText("Noches")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar álbumes"), "ta{Enter}");
    expect(await screen.findByText("Tardes")).toBeInTheDocument();
    expect(catalogService.listAdminAlbums).toHaveBeenNthCalledWith(2, {
      includeRetired: true,
      limit: 10,
      offset: 0,
      q: "ta",
    });
  });

  it("routes account searches to the account moderation endpoint", async () => {
    const user = userEvent.setup();
    jest.mocked(userService.listAdminUsers).mockResolvedValueOnce(usersResponse)
      .mockResolvedValueOnce({
        data: [
          {
            id: "user-3",
            username: "diana",
            email: "diana@example.com",
            role: "listener",
            isActive: true,
            banStatus: "ACTIVE",
            bannedUntil: null,
            createdAt: "2026-05-20T12:00:00Z",
          },
        ],
        pagination: {
          ...pagination,
          dataCount: 1,
          total: 1,
        },
      });

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    expect(await screen.findByText("listener@example.com")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar cuentas"), "dia{Enter}");
    expect(await screen.findByText("diana@example.com")).toBeInTheDocument();
    expect(userService.listAdminUsers).toHaveBeenNthCalledWith(2, {
      limit: 10,
      offset: 0,
      q: "dia",
    });
  });

  it("reuses the active search term when switching to account moderation", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listAdminTracks).mockResolvedValueOnce(trackResponse)
      .mockResolvedValueOnce({
        data: [
          {
            trackId: "track-2",
            title: "Dia gris",
            genre: "Pop",
            artistName: "Ada",
            albumTitle: null,
            status: "PUBLICADO",
            createdAt: "2026-05-21T12:00:00Z",
          },
        ],
        pagination: {
          ...pagination,
          dataCount: 1,
          total: 1,
        },
      });
    jest.mocked(userService.listAdminUsers).mockResolvedValueOnce(usersResponse)
      .mockResolvedValueOnce({
        data: [
          {
            id: "user-3",
            username: "diana",
            email: "diana@example.com",
            role: "listener",
            isActive: true,
            banStatus: "ACTIVE",
            bannedUntil: null,
            createdAt: "2026-05-20T12:00:00Z",
          },
        ],
        pagination: {
          ...pagination,
          dataCount: 1,
          total: 1,
        },
      });

    render(<AdminModerationPage toast={jest.fn()} />);

    expect(await screen.findByText("Luna")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar canciones"), "dia{Enter}");
    expect(await screen.findByText("Dia gris")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    await waitFor(() => expect(userService.listAdminUsers).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      q: "dia",
    }));
  });

  it("loads albums and retires an album through the in-app confirmation", async () => {
    const user = userEvent.setup();

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Álbumes" }));
    expect(await screen.findByText("Noches")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/retirar "Noches"/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Retirar álbum" }));

    await waitFor(() => expect(catalogService.retireAlbum).toHaveBeenCalledWith("album-1"));
  });

  it("reinstates a retired song through the in-app confirmation", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listAdminTracks).mockResolvedValueOnce({
      data: [
        {
          trackId: "track-1",
          title: "Luna",
          genre: "Rock",
          artistName: "Ada",
          albumTitle: null,
          status: "RETIRADO",
          visibilityReason: "ADMIN_RETIRED",
          createdAt: "2026-05-20T12:00:00Z",
        },
      ],
      pagination,
    });

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Reingresar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/reingresar "Luna"/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Reingresar canción" }));

    await waitFor(() => expect(catalogService.reinstateTrack).toHaveBeenCalledWith("track-1"));
  });

  it("omits artist-deleted tracks from moderation when the backend no longer returns them", async () => {
    jest.mocked(catalogService.listAdminTracks).mockResolvedValueOnce({
      data: [],
      pagination: {
        ...pagination,
        dataCount: 0,
        total: 0,
      },
    });

    render(<AdminModerationPage toast={jest.fn()} />);

    expect(await screen.findByText("No hay canciones registradas")).toBeInTheDocument();
  });

  it("loads accounts, bans a user, and reactivates a banned account", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();

    render(<AdminModerationPage toast={toast} />);

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    expect(await screen.findByText("listener@example.com")).toBeInTheDocument();
    expect(screen.getByText("Protegida")).toBeInTheDocument();
    expect(screen.getByText("Suspensión temporal")).toBeInTheDocument();
    expect(screen.getAllByText("Sin suspensión")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Suspender" }));
    await user.selectOptions(screen.getByDisplayValue("Temporal"), "PERMANENT");
    await user.type(screen.getByPlaceholderText("Opcional"), "Uso indebido");
    await user.click(screen.getByRole("button", { name: "Confirmar suspensión" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/permanentemente la cuenta listener/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Suspender cuenta" }));

    await waitFor(() => expect(userService.banUser).toHaveBeenCalledWith("user-1", {
      banType: "PERMANENT",
      durationAmount: undefined,
      durationUnit: undefined,
      reason: "Uso indebido",
    }));
    expect(toast).toHaveBeenCalledWith("Cuenta suspendida.");

    await user.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(userService.unbanUser).toHaveBeenCalledWith("user-2"));
  });

  it("normalizes temporary ban duration before confirming", async () => {
    const user = userEvent.setup();

    render(<AdminModerationPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    await screen.findByText("listener@example.com");

    await user.click(screen.getByRole("button", { name: "Suspender" }));
    await user.clear(screen.getByLabelText("Tiempo"));
    await user.click(screen.getByRole("button", { name: "Confirmar suspensión" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/por 1 días/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Suspender cuenta" }));

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
