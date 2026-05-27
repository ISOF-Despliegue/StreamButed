import { formatDate } from "./formatters";

describe("formatDate", () => {
  it("formats dates as dd-mm-yyyy", () => {
    expect(formatDate("2026-05-21T12:00:00Z")).toBe("21-05-2026");
  });

  it("uses the app timezone instead of the UTC calendar day", () => {
    expect(formatDate("2026-05-28T00:30:00.000Z")).toBe("27-05-2026");
  });

  it("keeps date-only values as their explicit calendar date", () => {
    expect(formatDate("2026-05-21")).toBe("21-05-2026");
  });

  it("returns a placeholder for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("--");
    expect(formatDate("not-a-date")).toBe("--");
  });
});
