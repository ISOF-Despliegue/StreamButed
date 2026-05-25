import { apiRequest } from "./apiClient";
import { libraryService } from "./libraryService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("libraryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the trailing-slash library root endpoint", async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({ playlists: [], likedSongs: null } as never);

    await libraryService.getLibrary();

    expect(apiRequest).toHaveBeenCalledWith("/library/");
  });
});
