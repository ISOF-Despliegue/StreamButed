import { act, fireEvent, render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";
import { Toast } from "./Toast";
import { TrackRow } from "./TrackRow";

const baseTrack = {
  id: "track-1",
  artistId: "artist-1",
  artistName: "Ada",
  duration: 125,
  genre: "Jazz",
  title: "Blue room",
};

function renderTrackRow(overrides = {}) {
  const onPlay = overrides.onPlay ?? jest.fn();
  const onArtistClick = overrides.onArtistClick ?? jest.fn();
  const track = { ...baseTrack, ...overrides.track };

  const view = render(
    <table>
      <tbody>
        <TrackRow
          index={0}
          isPlaying={overrides.isPlaying}
          onArtistClick={onArtistClick}
          onPlay={onPlay}
          track={track}
          metaText={overrides.metaText}
          contextText={overrides.contextText}
          actions={overrides.actions}
        />
      </tbody>
    </table>
  );

  return { onArtistClick, onPlay, ...view };
}

describe("small ui components", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("dismisses a toast after the timeout", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<Toast msg="Guardado" onDone={onDone} />);

    act(() => jest.advanceTimersByTime(2200));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("cancels a toast timeout when it unmounts", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const { unmount } = render(<Toast msg="Guardado" onDone={onDone} />);

    unmount();
    act(() => jest.advanceTimersByTime(2200));

    expect(onDone).not.toHaveBeenCalled();
  });

  it("emits the rounded progress value from a click position", () => {
    const onChange = jest.fn();
    render(<ProgressBar value={20} max={100} onChange={onChange} />);
    const progress = screen.getByRole("button", { name: "Cambiar progreso" });
    Object.defineProperty(progress, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 10, width: 200 }),
    });

    fireEvent.click(progress, { clientX: 110 });

    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("caps the visual fill when the current value exceeds the max", () => {
    const { container } = render(<ProgressBar value={150} max={100} />);

    expect(container.querySelector(".progress-fill")).toHaveStyle({ width: "100%" });
  });

  it("uses a safe max when the max value is invalid", () => {
    const { container } = render(<ProgressBar value={1} max={0} />);

    expect(container.querySelector(".progress-fill")).toHaveStyle({ width: "100%" });
  });

  it("does not emit progress when the bar geometry is unavailable", () => {
    const onChange = jest.fn();
    render(<ProgressBar value={20} max={100} onChange={onChange} />);
    const progress = screen.getByRole("button", { name: "Cambiar progreso" });
    Object.defineProperty(progress, "getBoundingClientRect", {
      configurable: true,
      value: () => undefined,
    });

    fireEvent.click(progress, { clientX: 110 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("starts playback when a track row is selected", () => {
    const { onPlay } = renderTrackRow();

    fireEvent.click(screen.getByText("Blue room"));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("opens the artist from the artist link without playing the row", () => {
    const onArtistClick = jest.fn();
    renderTrackRow({ onArtistClick });

    fireEvent.click(screen.getByRole("button", { name: "Ada" }));

    expect(onArtistClick).toHaveBeenCalledWith("artist-1");
  });

  it("keeps row playback untouched when an inline action is selected", () => {
    const onPlay = jest.fn();
    renderTrackRow({ onPlay, actions: <button type="button">Quitar</button> });

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(onPlay).not.toHaveBeenCalled();
  });

  it("renders the supplied context text for playlist rows", () => {
    renderTrackRow({ contextText: "Mi playlist" });

    expect(screen.getByText("Mi playlist")).toBeInTheDocument();
  });

  it("renders a fallback duration when the track identifier is missing", () => {
    renderTrackRow({ track: { id: undefined, trackId: undefined } });

    expect(screen.getByText("--:--")).toBeInTheDocument();
  });

  it("prefers explicit row metadata over generated metadata", () => {
    renderTrackRow({ metaText: "Favorita" });

    expect(screen.getByText("Favorita")).toBeInTheDocument();
  });

  it("uses play counts as generated metadata when no explicit metadata is passed", () => {
    renderTrackRow({ track: { plays: 1234 } });

    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
