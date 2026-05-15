import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type { Producer, Transport, TransportOptions } from "mediasoup-client/types";
import type { Socket } from "socket.io-client";
import { browserLogger } from "../utils/browserLogger";

export type ArtistLiveState =
  | "idle"
  | "requesting-media"
  | "connecting"
  | "live"
  | "ending"
  | "ended"
  | "error";

interface UseArtistLiveReturn {
  localStream: MediaStream | null;
  state: ArtistLiveState;
  error: string | null;
  roomId: string | null;
  title: string | null;
  listenerCount: number;
  goLive: (title: string) => Promise<void>;
  endLive: () => Promise<void>;
  clearError: () => void;
}

function emitAsync<T>(
  socket: Socket,
  event: string,
  data: unknown,
  resultEvent: string,
  errorEvent: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      socket.off(resultEvent, handleResult);
      socket.off(errorEvent, handleError);
      reject(new Error(`Timeout esperando ${resultEvent}`));
    }, 15000);

    const handleResult = (payload: T) => {
      globalThis.clearTimeout(timeout);
      socket.off(errorEvent, handleError);
      resolve(payload);
    };

    const handleError = ({ message }: { message: string }) => {
      globalThis.clearTimeout(timeout);
      socket.off(resultEvent, handleResult);
      reject(new Error(message));
    };

    socket.once(resultEvent, handleResult);
    socket.once(errorEvent, handleError);
    socket.emit(event, data);
  });
}

async function requestStrictCameraAndMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador no soporta getUserMedia.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  } catch (firstError) {
    browserLogger.error("getUserMedia audio+video failed.", firstError);

    let cameraWorks = false;
    let micWorks = false;

    try {
      const videoTest = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoTest.getTracks().forEach((track) => track.stop());
      cameraWorks = true;
    } catch (videoError) {
      browserLogger.error("Camera test failed.", videoError);
    }

    try {
      const audioTest = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      audioTest.getTracks().forEach((track) => track.stop());
      micWorks = true;
    } catch (audioError) {
      browserLogger.error("Microphone test failed.", audioError);
    }

    if (!cameraWorks && !micWorks) {
      throw new Error(
        "No se pudo acceder a camara ni microfono. Revisa permisos de Windows y del navegador."
      );
    }

    if (!cameraWorks) {
      throw new Error(
        "No se pudo acceder a la camara. Revisa que este activa y permitida para el navegador."
      );
    }

    if (!micWorks) {
      throw new Error(
        "No se pudo acceder al microfono. Revisa que este activo y permitido para el navegador."
      );
    }

    throw firstError;
  }
}

export function useArtistLive(socket: Socket | null): UseArtistLiveReturn {
  const [state, setState] = useState<ArtistLiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [listenerCount, setListenerCount] = useState(0);

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const audioProducerRef = useRef<Producer | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const cleanupResources = useCallback(() => {
    audioProducerRef.current?.close();
    videoProducerRef.current?.close();
    sendTransportRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    audioProducerRef.current = null;
    videoProducerRef.current = null;
    sendTransportRef.current = null;
    streamRef.current = null;
    deviceRef.current = null;
    roomIdRef.current = null;

    setLocalStream(null);
    setListenerCount(0);
  }, []);

  const goLive = useCallback(
    async (newTitle: string) => {
      if (!socket) {
        setError("No hay conexion con live-service.");
        return;
      }

      if (state === "live") {
        return;
      }

      if (state !== "idle" && state !== "ended" && state !== "error") {
        return;
      }

      setError(null);

      try {
        setState("requesting-media");
        const stream = await requestStrictCameraAndMicrophone();
        streamRef.current = stream;
        setLocalStream(stream);

        setState("connecting");

        const { roomId: newRoomId, routerRtpCapabilities } = await emitAsync<{
          roomId: string;
          routerRtpCapabilities: object;
        }>(socket, "live:create", { title: newTitle }, "live:created", "live:create:error");

        setRoomId(newRoomId);
        roomIdRef.current = newRoomId;
        setTitle(newTitle);
        setListenerCount(0);

        const device = new Device();
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;

        const transportParams = await emitAsync<TransportOptions>(
          socket,
          "live:createTransport",
          { roomId: newRoomId, direction: "send" },
          "live:transportCreated",
          "live:createTransport:error"
        );

        const sendTransport = device.createSendTransport(transportParams);
        sendTransportRef.current = sendTransport;

        sendTransport.on("connect", async ({ dtlsParameters }, callback, errCallback) => {
          try {
            await emitAsync(
              socket,
              "live:connectTransport",
              {
                roomId: newRoomId,
                transportId: sendTransport.id,
                dtlsParameters,
                direction: "send",
              },
              "live:transportConnected",
              "live:connectTransport:error"
            );
            callback();
          } catch (transportError) {
            errCallback(transportError as Error);
          }
        });

        sendTransport.on(
          "produce",
          async ({ kind, rtpParameters, appData }, callback, errCallback) => {
            try {
              const { producerId } = await emitAsync<{ producerId: string }>(
                socket,
                "live:produce",
                { roomId: newRoomId, kind, rtpParameters, appData },
                "live:produced",
                "live:produce:error"
              );
              callback({ id: producerId });
            } catch (produceError) {
              errCallback(produceError as Error);
            }
          }
        );

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          throw new Error("No se obtuvo pista de audio del microfono.");
        }

        audioProducerRef.current = await sendTransport.produce({
          track: audioTrack,
          codecOptions: { opusStereo: true, opusDtx: true },
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No se obtuvo pista de video de la camara.");
        }

        videoProducerRef.current = await sendTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100_000, scaleResolutionDownBy: 4 },
            { maxBitrate: 500_000, scaleResolutionDownBy: 2 },
            { maxBitrate: 1_200_000, scaleResolutionDownBy: 1 },
          ],
          codecOptions: { videoGoogleStartBitrate: 1000 },
        });

        setState("live");
      } catch (liveError) {
        const message = liveError instanceof Error ? liveError.message : String(liveError);
        setError(message);
        setState("error");

        if (roomIdRef.current && socket) {
          socket.emit("live:end", { roomId: roomIdRef.current });
        }

        cleanupResources();
        setRoomId(null);
        setTitle(null);
      }
    },
    [socket, state, cleanupResources]
  );

  const endLive = useCallback(async () => {
    const activeRoomId = roomIdRef.current || roomId;

    if (!socket || !activeRoomId || state !== "live") {
      return;
    }

    setState("ending");
    socket.emit("live:end", { roomId: activeRoomId });

    cleanupResources();
    setRoomId(null);
    setTitle(null);
    setState("ended");
  }, [socket, roomId, state, cleanupResources]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleEnded = () => {
      cleanupResources();
      setRoomId(null);
      setTitle(null);
      setState("ended");
    };

    const handleListenerCount = ({ count }: { count: number }) => {
      setListenerCount(count);
    };

    socket.on("live:ended", handleEnded);
    socket.on("live:listenerCount", handleListenerCount);

    return () => {
      socket.off("live:ended", handleEnded);
      socket.off("live:listenerCount", handleListenerCount);
    };
  }, [socket, cleanupResources]);

  useEffect(() => {
    return () => {
      if (roomIdRef.current && socket) {
        socket.emit("live:end", { roomId: roomIdRef.current });
      }

      cleanupResources();
    };
  }, [socket, cleanupResources]);

  return { localStream, state, error, roomId, title, listenerCount, goLive, endLive, clearError };
}
