import { formatDate } from "./formatters";

describe("formatDate", () => {
  it("formats dates as dd-mm-yyyy", () => {
    expect(formatDate("2026-05-21T00:00:00Z")).toBe("21-05-2026");
  });

  it("returns a placeholder for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("--");
    expect(formatDate("not-a-date")).toBe("--");
  });
});
