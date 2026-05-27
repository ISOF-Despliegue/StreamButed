import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../../services/apiClient";
import { ArtistLiveRoom } from "./ArtistLiveRoom";
import { ListenerLiveRoom } from "./ListenerLiveRoom";
import { LiveConcertsPage } from "./LiveConcertsPage";

const mockUseLive = jest.fn();
const mockUseListenerLive = jest.fn();

jest.mock("../../hooks/useLive", () => ({
  useLive: () => mockUseLive(),
}));

jest.mock("../../hooks/useListenerLive", () => ({
  useListenerLive: (socket: unknown) => mockUseListenerLive(socket),
}));

jest.mock("../../services/apiClient", () => ({
  apiRequest: jest.fn(),
}));

const artistControls = {
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

const listenerControls = {
  remoteStream: null,
  state: "watching",
  error: null,
  listenerCount: 4,
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
};

const liveRoom = {
  id: "room-1",
  artistId: "artist-1",
  artistName: "Ada",
  title: "Acoustic night",
  status: "LIVE" as const,
  listeners: 3,
};

function arrangeLiveContext(overrides: Record<string, unknown> = {}) {
  mockUseLive.mockReturnValue({
    token: "token-1",
    socket: { id: "socket-1" },
    connectionState: "connected",
    artist: artistControls,
    ...overrides,
  });
}

describe("live pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeLiveContext();
    mockUseListenerLive.mockReturnValue(listenerControls);
    jest.mocked(apiRequest).mockResolvedValue([liveRoom] as never);
  });

  it("keeps the artist start action disabled until a title is entered", () => {
    render(<ArtistLiveRoom />);

    expect(screen.getByRole("button", { name: "Iniciar concierto" })).toBeDisabled();
  });

  it("starts the artist live session with the trimmed title", async () => {
    const user = userEvent.setup();
    render(<ArtistLiveRoom />);

    await user.type(screen.getByLabelText(/concierto/i), "  Sala intima  ");
    await user.click(screen.getByRole("button", { name: "Iniciar concierto" }));

    expect(artistControls.goLive).toHaveBeenCalledWith("Sala intima");
  });

  it("ends an active artist live session from the live room", async () => {
    const user = userEvent.setup();
    arrangeLiveContext({
      artist: { ...artistControls, state: "live", title: "Sala intima", listenerCount: 7 },
    });

    render(<ArtistLiveRoom />);

    await user.click(screen.getByRole("button", { name: "Terminar concierto" }));

    expect(artistControls.endLive).toHaveBeenCalledTimes(1);
  });

  it("joins the listener room once the live socket is connected", async () => {
    render(<ListenerLiveRoom roomId="room-1" />);

    await waitFor(() => expect(listenerControls.joinRoom).toHaveBeenCalledWith("room-1"));
  });

  it("calls the leave callback after a listener exits the room", async () => {
    const user = userEvent.setup();
    const onLeave = jest.fn();
    render(<ListenerLiveRoom roomId="room-1" onLeave={onLeave} />);

    await user.click(screen.getByRole("button", { name: "Salir" }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("renders live rooms returned by the API", async () => {
    render(<LiveConcertsPage userRole="listener" />);

    expect(await screen.findByText("Acoustic night")).toBeInTheDocument();
  });

  it("passes the selected live room to the join handler", async () => {
    const user = userEvent.setup();
    const onJoinRoom = jest.fn();
    render(<LiveConcertsPage userRole="listener" onJoinRoom={onJoinRoom} />);

    await screen.findByText("Acoustic night");
    await user.click(screen.getByRole("button", { name: "Unirse al concierto" }));

    expect(onJoinRoom).toHaveBeenCalledWith(expect.objectContaining({ id: "room-1" }));
  });

  it("shows a session validation error when the live token is missing", async () => {
    arrangeLiveContext({ token: null });

    render(<LiveConcertsPage userRole="listener" />);

    expect(await screen.findByText(/No pudimos validar/)).toBeInTheDocument();
  });

  it("offers artists a return action while their stream is already live", () => {
    arrangeLiveContext({
      artist: { ...artistControls, state: "live", title: "Sala intima" },
    });

    render(<LiveConcertsPage userRole="artist" onStartBroadcast={jest.fn()} />);

    expect(screen.getByRole("button", { name: /Ver mi/ })).toBeInTheDocument();
  });
});
