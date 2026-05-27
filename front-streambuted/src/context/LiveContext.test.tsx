import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { LiveProvider } from "./LiveContext";
import { LiveContext } from "./liveContextValue";

const mockUseAuth = jest.fn();
const mockUseLiveSocket = jest.fn();
const mockUseArtistLive = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../hooks/useLiveSocket", () => ({
  useLiveSocket: (token: string | null) => mockUseLiveSocket(token),
}));

jest.mock("../hooks/useArtistLive", () => ({
  useArtistLive: (socket: unknown) => mockUseArtistLive(socket),
}));

const artistLiveValue = {
  localStream: null,
  state: "idle",
  error: null,
  roomId: null,
  title: null,
  listenerCount: 0,
  goLive: jest.fn(),
  endLive: jest.fn(),
  clearError: jest.fn(),
};

function LiveProbe() {
  const value = useContext(LiveContext);

  return <div>{value?.connectionState}</div>;
}

describe("LiveProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ accessToken: "token-1" });
    mockUseLiveSocket.mockReturnValue({ socket: { id: "socket-1" }, connectionState: "connected" });
    mockUseArtistLive.mockReturnValue(artistLiveValue);
  });

  it("provides the connection state returned by the socket hook", () => {
    render(
      <LiveProvider>
        <LiveProbe />
      </LiveProvider>
    );

    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("passes the active socket into the artist live hook", () => {
    render(
      <LiveProvider>
        <LiveProbe />
      </LiveProvider>
    );

    expect(mockUseArtistLive).toHaveBeenCalledWith({ id: "socket-1" });
  });
});
