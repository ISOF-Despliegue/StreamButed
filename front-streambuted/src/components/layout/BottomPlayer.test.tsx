import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomPlayer } from "./BottomPlayer";

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
  shuffleEnabled: false,
};

describe("BottomPlayer", () => {
  it("disables album controls for a single track", () => {
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
      />
    );

    expect(screen.getByTitle("Aleatorio del album")).toBeDisabled();
    expect(screen.getByTitle("Pista anterior")).toBeDisabled();
    expect(screen.getByTitle("Siguiente pista")).toBeDisabled();
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
      />
    );

    await user.click(screen.getByTitle("Siguiente pista"));

    expect(screen.getByTitle("Aleatorio del album")).not.toBeDisabled();
    expect(screen.getByTitle("Pista anterior")).not.toBeDisabled();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
