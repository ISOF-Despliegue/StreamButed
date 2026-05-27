import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { LiveContext, type LiveContextValue } from "../context/liveContextValue";
import { useLive } from "./useLive";

const liveValue: LiveContextValue = {
  token: "token-1",
  socket: null,
  connectionState: "connected",
  artist: {
    localStream: null,
    state: "idle",
    error: null,
    roomId: null,
    title: null,
    listenerCount: 0,
    goLive: jest.fn(),
    endLive: jest.fn(),
    clearError: jest.fn(),
  },
};

function LiveWrapper({ children }: { children: ReactNode }) {
  return <LiveContext.Provider value={liveValue}>{children}</LiveContext.Provider>;
}

describe("useLive", () => {
  it("returns the live context value from its provider", () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveWrapper });

    expect(result.current.token).toBe("token-1");
  });

  it("throws when used outside LiveProvider", () => {
    expect(() => renderHook(() => useLive())).toThrow("useLive must be used inside LiveProvider.");
  });
});
