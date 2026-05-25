import { act, renderHook } from "@testing-library/react";
import { useSearchController } from "./useSearchController";

describe("useSearchController", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("clears the manual cooldown after the window expires", () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() =>
      useSearchController({
        manualCooldownMs: 800,
        minAutoLength: 3,
        onSearch,
      })
    );

    act(() => {
      result.current.setSearchValue("ab");
    });

    act(() => {
      result.current.submitSearch("manual");
    });

    expect(result.current.cooldownUntil).toBeGreaterThan(Date.now());

    act(() => {
      jest.advanceTimersByTime(801);
    });

    expect(result.current.cooldownUntil).toBe(0);
  });
});
