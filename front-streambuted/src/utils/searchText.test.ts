import {
  includesSearchTerm,
  normalizeSearchMatchValue,
  sanitizeSearchTerm,
} from "./searchText";

describe("searchText", () => {
  it("matches text without caring about accents or casing", () => {
    expect(includesSearchTerm("Quédate", "que")).toBe(true);
    expect(includesSearchTerm("ÁLBUM", "album")).toBe(true);
    expect(includesSearchTerm("Niña", "NINA")).toBe(true);
  });

  it("sanitizes visible search input while keeping a normalized match value", () => {
    expect(sanitizeSearchTerm("  Qué   tal  ")).toBe("Qué tal");
    expect(normalizeSearchMatchValue("  Qué   tal  ")).toBe("que tal");
  });
});
