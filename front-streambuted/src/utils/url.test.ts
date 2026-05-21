import { withQuery } from "./url";

describe("withQuery", () => {
  it("adds only defined query params", () => {
    expect(withQuery("/catalog/search", {
      q: "luna",
      limit: 10,
      offset: 0,
      empty: "",
      missing: undefined,
    })).toBe("/catalog/search?q=luna&limit=10&offset=0");
  });

  it("keeps the original path when there are no query params", () => {
    expect(withQuery("/users/admin", { limit: undefined })).toBe("/users/admin");
  });
});
