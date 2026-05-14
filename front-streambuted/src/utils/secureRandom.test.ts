import { getSecureRandomInt } from "./secureRandom";

describe("getSecureRandomInt", () => {
  it("returns an integer within range", () => {
    const value = getSecureRandomInt(5);

    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(5);
  });

  it("rejects invalid bounds", () => {
    expect(() => getSecureRandomInt(0)).toThrow("maxExclusive must be a positive integer.");
    expect(() => getSecureRandomInt(1.5)).toThrow("maxExclusive must be a positive integer.");
  });
});
