import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type { Consumer, ConsumerOptions, Transport, TransportOptions } from "mediasoup-client/types";
import type { Socket } from "socket.io-client";
import { browserLogger } from "../utils/browserLogger";

export type ListenerLiveState = "idle" | "joining" | "watching" | "ended" | "error";

interface UseListenerLiveReturn {
  remoteStream: MediaStream | null;
  state: ListenerLiveState;
  error: string | null;
  listenerCount: number;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
}

function emitAsync<T>(
  socket: Socket,
  event: string,
  data: unknown,
  resultEvent: string,
  errorEvent: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handleResult = (payload: T) => {
      socket.off(errorEvent, handleError);
      resolve(payload);
    };

    const handleError = ({ message }: { message: string }) => {
      socket.off(resultEvent, handleResult);
      reject(new Error(message));
    };

    socket.once(resultEvent, handleResult);
    socket.once(errorEvent, handleError);
    socket.emit(event, data);
  });
}

export function useListenerLive(socket: Socket | null): UseListenerLiveReturn {
  const [state, setState] = useState<ListenerLiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [listenerCount, setListenerCount] = useState(0);

  const deviceRef = useRef<Device | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const roomIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream>(new MediaStream());
  const isJoiningRef = useRef(false);

  const refreshRemoteStream = useCallback(() => {
    const tracks = streamRef.current.getTracks();
    setRemoteStream(tracks.length > 0 ? new MediaStream(tracks) : null);
  }, []);

  const consumeProducer = useCallback(
    async (producerId: string) => {
      if (!socket || !deviceRef.current || !recvTransportRef.current) {
        return;
      }

      const roomId = roomIdRef.current;
      if (!roomId) {
        return;
      }

      try {
        const consumerParams = await emitAsync<
          Omit<ConsumerOptions, "id"> & { consumerId: string }
        >(
          socket,
          "live:consume",
          {
            roomId,
            producerId,
            rtpCapabilities: deviceRef.current.rtpCapabilities,
          },
          "live:consumed",
          "live:consume:error"
        );

        const consumer = await recvTransportRef.current.consume({
          id: consumerParams.consumerId,
          producerId: consumerParams.producerId,
          kind: consumerParams.kind,
          rtpParameters: consumerParams.rtpParameters,
          appData: consumerParams.appData,
        });
        consumersRef.current.set(consumer.id, consumer);
        if (!streamRef.current.getTracks().some((track) => track.id === consumer.track.id)) {
          streamRef.current.addTrack(consumer.track);
        }

        refreshRemoteStream();
        socket.emit("live:resumeConsumer", { roomId, consumerId: consumerParams.consumerId });

        consumer.on("trackended", () => {
          streamRef.current.removeTrack(consumer.track);
          consumer.close();
          consumersRef.current.delete(consumer.id);
          refreshRemoteStream();
        });
      } catch (consumeError) {
        browserLogger.warn(`Failed to consume producer ${producerId}.`, consumeError);
      }
    },
    [socket, refreshRemoteStream]
  );

  const cleanupResources = useCallback(() => {
    consumersRef.current.forEach((consumer) => consumer.close());
    consumersRef.current.clear();
    recvTransportRef.current?.close();
    recvTransportRef.current = null;
    deviceRef.current = null;
    roomIdRef.current = null;
    streamRef.current = new MediaStream();
    isJoiningRef.current = false;
    setRemoteStream(null);
  }, []);

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!socket) {
        setError("Not connected to live server");
        return;
      }

      if (isJoiningRef.current || (state !== "idle" && state !== "ended")) {
        return;
      }

      isJoiningRef.current = true;
      setError(null);
      setState("joining");

      try {
        const { routerRtpCapabilities, producerIds } = await emitAsync<{
          routerRtpCapabilities: object;
          producerIds: string[];
        }>(socket, "live:join", { roomId }, "live:joined", "live:join:error");

        roomIdRef.current = roomId;

        const device = new Device();
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;

        const transportParams = await emitAsync<TransportOptions>(
          socket,
          "live:createTransport",
          { roomId, direction: "recv" },
          "live:transportCreated",
          "live:createTransport:error"
        );

        const recvTransport = device.createRecvTransport(transportParams);
        recvTransportRef.current = recvTransport;

        recvTransport.on("connect", async ({ dtlsParameters }, callback, errCallback) => {
          try {
            await emitAsync(
              socket,
              "live:connectTransport",
              { roomId, transportId: recvTransport.id, dtlsParameters, direction: "recv" },
              "live:transportConnected",
              "live:connectTransport:error"
            );
            callback();
          } catch (transportError) {
            errCallback(transportError as Error);
          }
        });

        for (const producerId of producerIds) {
          await consumeProducer(producerId);
        }

        setState("watching");
        isJoiningRef.current = false;
      } catch (joinError) {
        const message = joinError instanceof Error ? joinError.message : String(joinError);
        isJoiningRef.current = false;
        setError(message);
        setState("error");
        cleanupResources();
      }
    },
    [socket, state, consumeProducer, cleanupResources]
  );

  const leaveRoom = useCallback(() => {
    if (socket && roomIdRef.current) {
      socket.emit("live:leave", { roomId: roomIdRef.current });
    }

    cleanupResources();
    setListenerCount(0);
    setState("idle");
  }, [socket, cleanupResources]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleNewProducer = ({ producerId }: { producerId: string }) => {
      void consumeProducer(producerId);
    };

    const handleEnded = ({ reason }: { reason: string }) => {
      browserLogger.info(`Live concert ended: ${reason}`);
      cleanupResources();
      setState("ended");
    };

    const handleListenerCount = ({ count }: { count: number }) => {
      setListenerCount(count);
    };

    socket.on("live:newProducer", handleNewProducer);
    socket.on("live:ended", handleEnded);
    socket.on("live:listenerCount", handleListenerCount);

    return () => {
      socket.off("live:newProducer", handleNewProducer);
      socket.off("live:ended", handleEnded);
      socket.off("live:listenerCount", handleListenerCount);
    };
  }, [socket, consumeProducer, cleanupResources]);

  useEffect(() => {
    return () => {
      if (socket && roomIdRef.current) {
        socket.emit("live:leave", { roomId: roomIdRef.current });
      }

      cleanupResources();
    };
  }, [socket, cleanupResources]);

  return { remoteStream, state, error, listenerCount, joinRoom, leaveRoom };
}
