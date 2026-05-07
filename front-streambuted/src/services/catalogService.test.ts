import { catalogService } from "./catalogService";

describe("catalogService", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ artists: [], albums: [], tracks: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("calls catalog search through gateway", async () => {
    await catalogService.searchCatalog({ q: "night", limit: 10, offset: 5 });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/catalog/search?q=night&limit=10&offset=5",
      expect.any(Object)
    );
  });
});
