import { act, renderHook, waitFor } from "@testing-library/react";
import { useArtistLive } from "./useArtistLive";
import { useListenerLive } from "./useListenerLive";
import { useLiveSocket } from "./useLiveSocket";

const mockCreateSendTransport = jest.fn();
const mockCreateRecvTransport = jest.fn();
const mockSocketIo = jest.fn();

jest.mock("mediasoup-client", () => ({
  Device: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    rtpCapabilities: { codecs: [] },
    createSendTransport: mockCreateSendTransport,
    createRecvTransport: mockCreateRecvTransport,
  })),
}));

jest.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => mockSocketIo(...args),
}));

type EventHandler = (...args: any[]) => void;

class FakeSocket {
  private handlers = new Map<string, Set<EventHandler>>();
  private onceHandlers = new Map<string, Set<EventHandler>>();

  public readonly emitted: Array<{ event: string; data: unknown }> = [];

  public readonly on = jest.fn((event: string, handler: EventHandler) => {
    this.addHandler(this.handlers, event, handler);
    return this;
  });

  public readonly once = jest.fn((event: string, handler: EventHandler) => {
    this.addHandler(this.onceHandlers, event, handler);
    return this;
  });

  public readonly off = jest.fn((event: string, handler: EventHandler) => {
    this.handlers.get(event)?.delete(handler);
    this.onceHandlers.get(event)?.delete(handler);
    return this;
  });

  public readonly disconnect = jest.fn();

  constructor(
    private readonly responses: Record<
      string,
      { resultEvent: string; payload: unknown | ((data: unknown) => unknown) }
    > = {}
  ) {}

  public readonly emit = jest.fn((event: string, data: unknown) => {
    this.emitted.push({ event, data });
    const response = this.responses[event];

    if (response) {
      queueMicrotask(() => {
        const payload =
          typeof response.payload === "function" ? response.payload(data) : response.payload;
        this.dispatch(response.resultEvent, payload);
      });
    }

    return this;
  });

  public dispatch(event: string, payload?: unknown) {
    const onceHandlers = Array.from(this.onceHandlers.get(event) ?? []);
    this.onceHandlers.delete(event);
    onceHandlers.forEach((handler) => handler(payload));
    Array.from(this.handlers.get(event) ?? []).forEach((handler) => handler(payload));
  }

  private addHandler(map: Map<string, Set<EventHandler>>, event: string, handler: EventHandler) {
    const eventHandlers = map.get(event) ?? new Set<EventHandler>();
    eventHandlers.add(handler);
    map.set(event, eventHandlers);
  }
}

class FakeMediaStream {
  private tracks: MediaStreamTrack[];

  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }

  getTracks() {
    return [...this.tracks];
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }

  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack) {
    this.tracks = this.tracks.filter((currentTrack) => currentTrack !== track);
  }
}

function createTrack(kind: "audio" | "video", id: string): MediaStreamTrack {
  return {
    id,
    kind,
    stop: jest.fn(),
  } as unknown as MediaStreamTrack;
}

function createArtistSocket() {
  return new FakeSocket({
    "live:create": {
      resultEvent: "live:created",
      payload: { roomId: "room-1", routerRtpCapabilities: { codecs: [] } },
    },
    "live:createTransport": {
      resultEvent: "live:transportCreated",
      payload: { id: "transport-1", iceParameters: {}, iceCandidates: [], dtlsParameters: {} },
    },
    "live:connectTransport": {
      resultEvent: "live:transportConnected",
      payload: {},
    },
    "live:produce": {
      resultEvent: "live:produced",
      payload: (data) => ({ producerId: `producer-${(data as { kind: string }).kind}` }),
    },
  });
}

function createListenerSocket() {
  return new FakeSocket({
    "live:join": {
      resultEvent: "live:joined",
      payload: { routerRtpCapabilities: { codecs: [] }, producerIds: ["producer-video"] },
    },
    "live:createTransport": {
      resultEvent: "live:transportCreated",
      payload: { id: "transport-1", iceParameters: {}, iceCandidates: [], dtlsParameters: {} },
    },
    "live:connectTransport": {
      resultEvent: "live:transportConnected",
      payload: {},
    },
    "live:consume": {
      resultEvent: "live:consumed",
      payload: {
        consumerId: "consumer-1",
        producerId: "producer-video",
        kind: "video",
        rtpParameters: {},
        appData: {},
      },
    },
  });
}

function createSendTransport() {
  const handlers = new Map<string, EventHandler>();
  let connected = false;

  return {
    id: "send-transport",
    close: jest.fn(),
    on: jest.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    }),
    produce: jest.fn(async ({ track }: { track: MediaStreamTrack }) => {
      if (!connected && handlers.has("connect")) {
        await new Promise<void>((resolve, reject) => {
          handlers.get("connect")?.({ dtlsParameters: {} }, resolve, reject);
        });
        connected = true;
      }

      if (handlers.has("produce")) {
        await new Promise<void>((resolve, reject) => {
          handlers.get("produce")?.(
            { kind: track.kind, rtpParameters: {}, appData: {} },
            () => resolve(),
            reject
          );
        });
      }

      return { id: `producer-${track.kind}`, close: jest.fn() };
    }),
  };
}

function createRecvTransport() {
  const handlers = new Map<string, EventHandler>();
  let connected = false;

  return {
    id: "recv-transport",
    close: jest.fn(),
    on: jest.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    }),
    consume: jest.fn(async ({ id, producerId, kind }: { id: string; producerId: string; kind: "audio" | "video" }) => {
      if (!connected && handlers.has("connect")) {
        await new Promise<void>((resolve, reject) => {
          handlers.get("connect")?.({ dtlsParameters: {} }, resolve, reject);
        });
        connected = true;
      }

      return {
        id,
        producerId,
        track: createTrack(kind, `remote-${id}`),
        close: jest.fn(),
        on: jest.fn(),
      };
    }),
  };
}

describe("live hooks", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "MediaStream", {
      value: FakeMediaStream,
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCreateSendTransport.mockImplementation(() => createSendTransport());
    mockCreateRecvTransport.mockImplementation(() => createRecvTransport());

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue(
          new FakeMediaStream([
            createTrack("audio", "audio-track"),
            createTrack("video", "video-track"),
          ])
        ),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("connects the live socket with the gateway token", () => {
    const socket = new FakeSocket();
    mockSocketIo.mockReturnValue(socket);

    renderHook(() => useLiveSocket("access-token"));

    expect(mockSocketIo).toHaveBeenCalledWith(
      "https://api.migueleelg0106.me",
      expect.objectContaining({ auth: { token: "access-token" } })
    );
  });

  it("updates the live socket state after a successful connection", () => {
    const socket = new FakeSocket();
    mockSocketIo.mockReturnValue(socket);

    const { result } = renderHook(() => useLiveSocket("access-token"));

    act(() => {
      socket.dispatch("connect");
    });

    expect(result.current.connectionState).toBe("connected");
  });

  it("disconnects the previous socket when the token disappears", () => {
    const socket = new FakeSocket();
    mockSocketIo.mockReturnValue(socket);
    const { rerender } = renderHook(({ token }) => useLiveSocket(token), {
      initialProps: { token: "access-token" as string | null },
    });

    rerender({ token: null });

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("sets an artist error when starting without a socket", async () => {
    const { result } = renderHook(() => useArtistLive(null));

    await act(async () => {
      await result.current.goLive("Sesion");
    });

    expect(result.current.error).toContain("No hay conexi");
  });

  it("moves the artist live state to live after media and signaling succeed", async () => {
    const socket = createArtistSocket();
    const { result } = renderHook(() => useArtistLive(socket as never));

    await act(async () => {
      await result.current.goLive("Sesion acustica");
    });

    expect(result.current.state).toBe("live");
  });

  it("updates artist listener count from socket events", () => {
    const socket = createArtistSocket();
    const { result } = renderHook(() => useArtistLive(socket as never));

    act(() => {
      socket.dispatch("live:listenerCount", { count: 9 });
    });

    expect(result.current.listenerCount).toBe(9);
  });

  it("reports a microphone-specific error when only the camera permission works", async () => {
    const getUserMedia = jest.fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce(new FakeMediaStream([createTrack("video", "video-track")]))
      .mockRejectedValueOnce(new Error("microphone blocked"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const socket = createArtistSocket();
    const { result } = renderHook(() => useArtistLive(socket as never));

    await act(async () => {
      await result.current.goLive("Sesion diagnostico");
    });

    expect(result.current.error).toContain("micr");
  });

  it("emits the active artist room when ending a live session", async () => {
    const socket = createArtistSocket();
    const { result } = renderHook(() => useArtistLive(socket as never));

    await act(async () => {
      await result.current.goLive("Sesion acustica");
    });

    await act(async () => {
      await result.current.endLive();
    });

    expect(socket.emitted.some((call) => call.event === "live:end")).toBe(true);
  });

  it("sets a listener error when joining without a socket", async () => {
    const { result } = renderHook(() => useListenerLive(null));

    await act(async () => {
      await result.current.joinRoom("room-1");
    });

    expect(result.current.error).toContain("No hay conexi");
  });

  it("moves the listener live state to watching after consuming producers", async () => {
    const socket = createListenerSocket();
    const { result } = renderHook(() => useListenerLive(socket as never));

    await act(async () => {
      await result.current.joinRoom("room-1");
    });

    expect(result.current.state).toBe("watching");
  });

  it("emits leave when the listener exits an active room", async () => {
    const socket = createListenerSocket();
    const { result } = renderHook(() => useListenerLive(socket as never));

    await act(async () => {
      await result.current.joinRoom("room-1");
      result.current.leaveRoom();
    });

    expect(socket.emitted.some((call) => call.event === "live:leave")).toBe(true);
  });

  it("marks the listener room as ended when the artist finishes", async () => {
    const socket = createListenerSocket();
    const { result } = renderHook(() => useListenerLive(socket as never));

    await act(async () => {
      await result.current.joinRoom("room-1");
    });

    act(() => {
      socket.dispatch("live:ended", { reason: "artist-ended" });
    });

    await waitFor(() => expect(result.current.state).toBe("ended"));
  });
});
