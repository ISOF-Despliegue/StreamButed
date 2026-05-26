import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomPlayer } from "./BottomPlayer";
import { emitPlaylistCreated } from "../../services/libraryEvents";
import { libraryService } from "../../services/libraryService";

jest.mock("../../services/libraryService", () => ({
  libraryService: {
    addTrackToPlaylist: jest.fn(),
    listPlaylists: jest.fn(),
  },
}));

const track = {
  trackId: "track-1",
  artistId: "artist-1",
  albumId: "album-1",
  title: "Midnight Signals",
  genre: "Electronica",
  audioAssetId: "asset-1",
  coverAssetId: null,
  status: "PUBLICADO",
  createdAt: "2026-05-11T00:00:00Z",
  updatedAt: "2026-05-11T00:00:00Z",
};

const basePlayback = {
  isPlaying: false,
  isLoading: false,
  positionSeconds: 0,
  durationSeconds: 180,
  error: "",
  canUseAlbumControls: false,
  repeatEnabled: false,
  shuffleEnabled: false,
};

describe("BottomPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryService.listPlaylists).mockResolvedValue([]);
    jest.mocked(libraryService.addTrackToPlaylist).mockResolvedValue({} as never);
  });

  it("keeps shuffle disabled for singles but allows queue controls", () => {
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
      />
    );

    expect(screen.getByTitle("Aleatorio del álbum")).toBeDisabled();
    expect(screen.getByTitle("Pista anterior")).not.toBeDisabled();
    expect(screen.getByTitle("Siguiente pista")).not.toBeDisabled();
    expect(screen.getByTitle("Repetir")).not.toBeDisabled();
  });

  it("enables album controls and dispatches next action for album queues", async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={{ ...basePlayback, canUseAlbumControls: true }}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={onNext}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
      />
    );

    await user.click(screen.getByTitle("Siguiente pista"));

    expect(screen.getByTitle("Aleatorio del álbum")).not.toBeDisabled();
    expect(screen.getByTitle("Pista anterior")).not.toBeDisabled();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("dispatches repeat toggle and marks it active", async () => {
    const user = userEvent.setup();
    const onToggleRepeat = jest.fn();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={{ ...basePlayback, repeatEnabled: true }}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={onToggleRepeat}
      />
    );

    const repeatButton = screen.getByTitle("Repetir");
    expect(repeatButton).toHaveAttribute("aria-pressed", "true");

    await user.click(repeatButton);

    expect(onToggleRepeat).toHaveBeenCalledTimes(1);
  });

  it("marks shuffle as active when album shuffle is enabled", async () => {
    const user = userEvent.setup();
    const onToggleShuffle = jest.fn();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={{ ...basePlayback, canUseAlbumControls: true, shuffleEnabled: true }}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={onToggleShuffle}
        onToggleRepeat={jest.fn()}
      />
    );

    const shuffleButton = screen.getByTitle("Aleatorio del álbum");
    expect(shuffleButton).toHaveAttribute("aria-pressed", "true");
    expect(shuffleButton.className).toContain("active");

    await user.click(shuffleButton);

    expect(onToggleShuffle).toHaveBeenCalledTimes(1);
  });

  it("dispatches like toggle and exposes pressed state", async () => {
    const user = userEvent.setup();
    const onToggleLike = jest.fn();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        isLiked
        onToggleLike={onToggleLike}
      />
    );

    const likeButton = screen.getByTitle("Quitar me gusta");
    expect(likeButton).toHaveAttribute("aria-pressed", "true");

    await user.click(likeButton);

    expect(onToggleLike).toHaveBeenCalledTimes(1);
  });

  it("adds the current track to a selected playlist from the plus menu", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.listPlaylists).mockResolvedValue([
      {
        playlistId: "playlist-1",
        name: "Ruta",
        coverAssetId: null,
        isSystem: false,
        systemKey: null,
        trackCount: 0,
        createdAt: "2026-05-25T00:00:00Z",
        updatedAt: "2026-05-25T00:00:00Z",
      },
    ]);
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByTitle("Agregar a playlist"));
    await user.click(await screen.findByRole("menuitem", { name: "Ruta" }));

    expect(libraryService.addTrackToPlaylist).toHaveBeenCalledWith("playlist-1", "track-1");
  });

  it("shows a specific message when the song is already in the selected playlist", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();
    jest.mocked(libraryService.listPlaylists).mockResolvedValue([
      {
        playlistId: "playlist-1",
        name: "Ruta",
        coverAssetId: null,
        isSystem: false,
        systemKey: null,
        trackCount: 1,
        createdAt: "2026-05-25T00:00:00Z",
        updatedAt: "2026-05-25T00:00:00Z",
      },
    ]);
    jest.mocked(libraryService.addTrackToPlaylist).mockRejectedValue(
      new Error("This song is already in that playlist.")
    );

    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        toast={toast}
      />
    );

    await user.click(screen.getByTitle("Agregar a playlist"));
    await user.click(await screen.findByRole("menuitem", { name: "Ruta" }));

    expect(toast).toHaveBeenCalledWith("Esta canción ya se encuentra en esa playlist.");
  });

  it("does not refetch playlists when an empty playlist list has already loaded", async () => {
    const user = userEvent.setup();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByTitle("Agregar a playlist"));
    expect(await screen.findByText("No tienes playlists privadas.")).toBeInTheDocument();

    await user.click(document.body);
    await user.click(screen.getByTitle("Agregar a playlist"));

    expect(libraryService.listPlaylists).toHaveBeenCalledTimes(1);
  });

  it("updates the cached playlist menu when a new playlist is created elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <BottomPlayer
        track={track}
        onExpand={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByTitle("Agregar a playlist"));
    expect(await screen.findByText("No tienes playlists privadas.")).toBeInTheDocument();

    act(() => {
      emitPlaylistCreated({
        playlistId: "playlist-2",
        name: "Nueva lista",
        coverAssetId: null,
        isSystem: false,
        systemKey: null,
        trackCount: 0,
        createdAt: "2026-05-25T00:00:00Z",
        updatedAt: "2026-05-25T00:00:00Z",
      });
    });

    expect(await screen.findByRole("menuitem", { name: "Nueva lista" })).toBeInTheDocument();
    expect(libraryService.listPlaylists).toHaveBeenCalledTimes(1);
  });
});
