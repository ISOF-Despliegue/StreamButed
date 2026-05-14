import { browserNavigation, reloadCurrentPage } from "./navigation";

describe("navigation", () => {
  it("reloads the current browser page", () => {
    const reload = jest.spyOn(browserNavigation, "reloadImpl").mockImplementation(() => {});

    reloadCurrentPage();

    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });
});
