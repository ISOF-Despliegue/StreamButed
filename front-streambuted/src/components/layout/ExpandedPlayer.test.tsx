import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { libraryService } from "../../services/libraryService";

jest.mock("../../services/libraryService", () => ({
  libraryService: {
    addTrackToPlaylist: jest.fn(),
    listPlaylists: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
  getAssetUrl: (assetId: string) => `https://assets/${assetId}`,
}));

const track = {
  trackId: "track-1",
  artistId: "artist-1",
  title: "Bloody Stream",
  artist: "urielito",
  coverAssetId: "cover-1",
  durationSeconds: 261,
};

const basePlayback = {
  isPlaying: true,
  isLoading: false,
  positionSeconds: 89,
  durationSeconds: 261,
  error: "",
  canUseAlbumControls: false,
  repeatEnabled: false,
  shuffleEnabled: false,
};

describe("ExpandedPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryService.listPlaylists).mockResolvedValue([]);
    jest.mocked(libraryService.addTrackToPlaylist).mockResolvedValue({} as never);
  });

  it("shows library actions and the real queue duration for the active track", () => {
    render(
      <ExpandedPlayer
        track={track}
        queue={[{ ...track, durationSeconds: undefined }]}
        onClose={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        onSelectTrack={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        onToggleLike={jest.fn()}
        toast={jest.fn()}
      />
    );

    expect(screen.getByTitle("Me gusta")).toBeInTheDocument();
    expect(screen.getByTitle("Agregar a playlist")).toBeInTheDocument();
    expect(screen.getAllByText("4:21")).toHaveLength(2);
  });

  it("keeps unknown active queue durations hidden until metadata is available", () => {
    render(
      <ExpandedPlayer
        track={{ ...track, durationSeconds: undefined }}
        queue={[{ ...track, durationSeconds: undefined }]}
        onClose={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        onSelectTrack={jest.fn()}
        playback={{ ...basePlayback, durationSeconds: 0 }}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        onToggleLike={jest.fn()}
        toast={jest.fn()}
      />
    );

    expect(screen.queryByText("0:00")).not.toBeInTheDocument();
    expect(screen.getAllByText("--:--")).toHaveLength(2);
  });

  it("adds the current track to a selected playlist from the expanded player", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.listPlaylists).mockResolvedValue([
      {
        playlistId: "playlist-1",
        name: "Favoritas",
        coverAssetId: null,
        isSystem: false,
        systemKey: null,
        trackCount: 0,
        createdAt: "2026-05-25T00:00:00Z",
        updatedAt: "2026-05-25T00:00:00Z",
      },
    ]);

    render(
      <ExpandedPlayer
        track={track}
        queue={[track]}
        onClose={jest.fn()}
        volume={70}
        setVolume={jest.fn()}
        onSelectTrack={jest.fn()}
        playback={basePlayback}
        onTogglePlay={jest.fn()}
        onSeek={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onToggleShuffle={jest.fn()}
        onToggleRepeat={jest.fn()}
        onToggleLike={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByTitle("Agregar a playlist"));
    await user.click(await screen.findByRole("menuitem", { name: "Favoritas" }));

    expect(libraryService.addTrackToPlaylist).toHaveBeenCalledWith("playlist-1", "track-1");
  });
});
