import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPage } from "./ListenerPages";
import { catalogService } from "../../services/catalogService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    searchCatalog: jest.fn(),
  },
}));

describe("SearchPage", () => {
  it("calls catalog search endpoint through service", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [],
    });

    render(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
        setPage={jest.fn()}
        setViewAlbum={jest.fn()}
        setViewArtist={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, albums..."), "night");

    await waitFor(() => {
      expect(catalogService.searchCatalog).toHaveBeenCalledWith({
        q: "night",
        limit: 20,
        offset: 0,
      });
    });
  });
});
