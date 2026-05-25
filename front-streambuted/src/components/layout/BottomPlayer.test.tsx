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
  repeatEnabled: false,
  shuffleEnabled: false,
};

describe("BottomPlayer", () => {
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
});
