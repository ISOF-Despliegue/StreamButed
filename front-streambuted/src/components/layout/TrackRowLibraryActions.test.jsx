import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackRowLibraryActions } from "./TrackRowLibraryActions";
import { emitLikedSongsChanged } from "../../services/libraryEvents";
import { libraryService } from "../../services/libraryService";

jest.mock("./TrackLibraryActions", () => ({
  TrackLibraryActions: ({ isLiked, isLikeLoading, onToggleLike }) => (
    <div>
      <span>{`${isLiked}:${isLikeLoading}`}</span>
      <button onClick={onToggleLike} type="button">Toggle like</button>
    </div>
  ),
}));

jest.mock("../../services/libraryService", () => ({
  libraryService: {
    getTrackLikeStatus: jest.fn(),
    likeTrack: jest.fn(),
    unlikeTrack: jest.fn(),
  },
}));

describe("TrackRowLibraryActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryService.getTrackLikeStatus).mockResolvedValue({ trackId: "track-1", isLiked: false });
    jest.mocked(libraryService.likeTrack).mockResolvedValue({ trackId: "track-1", isLiked: true });
    jest.mocked(libraryService.unlikeTrack).mockResolvedValue({ trackId: "track-1", isLiked: false });
  });

  it("loads the like status for the current track", async () => {
    render(<TrackRowLibraryActions trackId="track-1" />);

    await waitFor(() => {
      expect(screen.getByText("false:false")).toBeInTheDocument();
    });
  });

  it("skips remote lookups when the row has no track id", async () => {
    render(<TrackRowLibraryActions trackId="" />);
    await Promise.resolve();

    expect(libraryService.getTrackLikeStatus).not.toHaveBeenCalled();
  });

  it("refreshes the row when liked songs change elsewhere", async () => {
    render(<TrackRowLibraryActions trackId="track-1" />);
    await waitFor(() => expect(libraryService.getTrackLikeStatus).toHaveBeenCalledTimes(1));

    emitLikedSongsChanged();

    await waitFor(() => {
      expect(libraryService.getTrackLikeStatus).toHaveBeenCalledTimes(2);
    });
  });

  it("likes an unliked track from the row controls", async () => {
    const user = userEvent.setup();
    render(<TrackRowLibraryActions trackId="track-1" />);
    await waitFor(() => expect(screen.getByText("false:false")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Toggle like" }));

    await waitFor(() => {
      expect(libraryService.likeTrack).toHaveBeenCalledWith("track-1");
    });
  });
});
