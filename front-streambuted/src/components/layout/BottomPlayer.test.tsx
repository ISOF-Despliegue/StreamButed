import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomPlayer } from "./BottomPlayer";
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
});
