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

  it("clears an empty manual search instead of submitting it", () => {
    const onClear = jest.fn();
    const { result } = renderHook(() =>
      useSearchController({
        onClear,
        onSearch: jest.fn(),
      })
    );

    act(() => result.current.setSearchValue("   "));
    onClear.mockClear();
    act(() => result.current.submitSearch("manual"));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("submits automatic searches after the debounce window", () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() =>
      useSearchController({
        autoDebounceMs: 300,
        minAutoLength: 3,
        onSearch,
      })
    );

    act(() => result.current.setSearchValue("luna"));
    act(() => jest.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledWith("luna", "auto");
  });

  it("skips automatic searches shorter than the configured minimum", () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() =>
      useSearchController({
        autoDebounceMs: 300,
        minAutoLength: 3,
        onSearch,
      })
    );

    act(() => result.current.setSearchValue("lu"));
    act(() => jest.advanceTimersByTime(300));

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("does not submit the same comparable term twice", () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() =>
      useSearchController({
        manualCooldownMs: 0,
        onSearch,
      })
    );

    act(() => result.current.setSearchValue("Luna"));
    act(() => result.current.submitSearch("manual"));
    act(() => result.current.submitSearch("manual"));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending automatic search when unmounted", () => {
    const onSearch = jest.fn();
    const { result, unmount } = renderHook(() =>
      useSearchController({
        autoDebounceMs: 300,
        minAutoLength: 3,
        onSearch,
      })
    );

    act(() => result.current.setSearchValue("luna"));
    unmount();
    act(() => jest.advanceTimersByTime(300));

    expect(onSearch).not.toHaveBeenCalled();
  });
});
