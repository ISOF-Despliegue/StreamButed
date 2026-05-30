# Live Service

## 1. Funcion del servicio

`live-service` implementa conciertos en vivo. No usa streaming HTTP tipo archivo, sino comunicacion en tiempo real con:

- `Socket.IO` para señalizacion;
- `mediasoup` como SFU;
- `WebRTC` para audio/video;
- `Express` para endpoints REST de salas;
- `JWKS` para autenticar sockets y requests.

Es el componente mas cercano a telecomunicaciones del repo.

## 2. Diferencia entre señalizacion y media

Hay dos planos distintos:

- plano de control: eventos Socket.IO y endpoints REST;
- plano de media: paquetes RTP/RTCP cifrados via WebRTC.

El gateway Nginx enruta la señalizacion por HTTP/WebSocket, pero el trafico de media entra y sale por puertos RTC directos publicados por Docker (`RTC_MIN_PORT` a `RTC_MAX_PORT`).

## 3. Protocolos tecnicos usados

### Socket.IO

Se usa para:

- autenticar conexion del cliente;
- crear sala;
- unirse;
- crear transportes WebRTC;
- conectar DTLS;
- producir audio/video;
- consumir productores remotos;
- reanudar consumidores;
- terminar sala;
- propagar conteo de listeners.

### WebRTC

WebRTC aporta:

- intercambio de capacidades RTP;
- ICE para descubrir camino de red;
- DTLS para negociar claves;
- SRTP para cifrar media;
- RTP para transportar audio/video;
- RTCP para control de calidad.

### mediasoup

`mediasoup` no mezcla media como un MCU; actua como SFU:

- recibe productores del artista;
- reenvia a cada listener;
- evita decodificar/recodificar en servidor;
- conserva eficiencia y menor latencia.

## 4. Flujo real de un live

### 4.1 Artista inicia

1. frontend pide `getUserMedia` para camara y microfono.
2. se autentica Socket.IO con JWT.
3. emite `live:create`.
4. `roomManager` crea `Room` con `Router` mediasoup.
5. el servidor responde `routerRtpCapabilities`.
6. cliente crea `Device` mediasoup-client.
7. pide `live:createTransport` con `direction=send`.
8. recibe ICE candidates, ICE params, DTLS params.
9. cliente conecta transporte con `live:connectTransport`.
10. produce audio y video con `live:produce`.
11. la sala pasa de `CREATED` a `LIVE`.

### 4.2 Listener entra

1. frontend lista salas por REST.
2. abre socket autenticado.
3. emite `live:join`.
4. recibe `routerRtpCapabilities` y `producerIds`.
5. crea `Device`.
6. pide transporte `recv`.
7. conecta DTLS.
8. por cada `producerId` ejecuta `live:consume`.
9. el servidor crea `Consumer` pausado.
10. el cliente agrega tracks remotos al `MediaStream`.
11. emite `live:resumeConsumer`.

## 5. Transmision de bits, video y microfono

### Captura de origen

En frontend, `useArtistLive.ts` usa:

- audio con `echoCancellation`, `noiseSuppression`, `sampleRate=48000`;
- video ideal `1280x720` a `30 fps`.

Eso significa que el origen ya nace digitalizado en el navegador.

### Codificacion y envio

El cliente no manda “archivo”; manda frames codificados en flujo continuo. La configuracion del stack revela:

- audio codec `Opus` a `48 kHz`, 2 canales;
- video codec `VP8` a `90 kHz` clock rate.

En WebRTC, esos frames se empaquetan en RTP. RTP no se preocupa por reensamblar el contenido como un archivo; transporta unidades de tiempo real con numeracion de secuencia, timestamps y sincronizacion.

### Bitrate

En `useArtistLive.ts`, el video usa simulcast-like encodings:

- `100_000` bps con `scaleResolutionDownBy: 4`;
- `500_000` bps con `scaleResolutionDownBy: 2`;
- `1_200_000` bps con `scaleResolutionDownBy: 1`.

Esto permite que el servidor y el cliente negocien mejor calidad segun capacidad de red.

### Transporte en servidor

`Room.createWebRtcTransport()` habilita:

- UDP y TCP;
- preferencia por UDP;
- bitrate inicial de salida `1_000_000`.

UDP es preferido porque en tiempo real importa mas la latencia que la retransmision perfecta. Perder algunos paquetes de video es normalmente mejor que esperar confirmaciones como en TCP.

### Cifrado

WebRTC usa DTLS para acordar claves y luego SRTP para cifrar el trafico multimedia. El repo no implementa eso manualmente; lo delega a mediasoup/WebRTC, que es exactamente lo correcto.

## 6. Estructuras internas

### Room

`Room` mantiene:

- `router`;
- mapas de `_transports`;
- mapas de `_producers`;
- mapas de `_consumers`;
- indice de consumidor por socket;
- conjunto `_listeners`.

Es el estado en memoria de una sala. No hay persistencia en BD, asi que el live es efimero por diseño.

### RoomManager

Controla:

- mapa de salas por `roomId`;
- indice de sala activa por `artistId`;
- cierre y limpieza.

Evita multiples salas activas por artista.

## 7. Autenticacion

`jwtValidator.js`:

- usa `jwks-rsa`;
- cachea hasta 5 claves durante 10 minutos;
- limita requests JWKS por minuto;
- valida `iss` y `aud`;
- luego consulta `identity-service/api/v1/auth/validate`.

La autenticacion aplica tanto a:

- REST (`authMiddleware`);
- Socket.IO (`io.use(...)`).

## 8. Que hace cada archivo

- `src/index.js`: arranque total, CORS, Express, HTTP server, Socket.IO y hook de autenticacion del socket.
- `src/logger.js`: logging estructurado con Winston.
- `src/http/errorResponse.js`: respuestas REST estandar de error.
- `src/auth/jwtValidator.js`: validacion JWT + estado de cuenta remoto.
- `src/auth/authMiddleware.js`: protege endpoints REST.
- `src/auth/profileClient.js`: consulta username actual en Identity para mostrar nombre de artista en sala.
- `src/validation/liveValidator.js`: valida strings, roomId, kind y direction.
- `src/routes/rooms.routes.js`: lista y crea salas via REST.
- `src/sfu/workerPool.js`: crea workers mediasoup y define codecs/puertos RTC.
- `src/rooms/Room.js`: maneja transportes, productores, consumidores y listeners de una sala.
- `src/rooms/roomManager.js`: registro global de salas en memoria.
- `src/signaling/signalingHandler.js`: cerebro de la señalizacion en tiempo real.

Pruebas:

- `tests/unit/auth/*`: auth y profile lookup.
- `tests/unit/rooms/*`: manejo de salas.
- `tests/unit/routes/*`: rutas REST.
- `tests/unit/signaling/*`: protocolo de eventos.
- `tests/unit/validation/*`: validaciones basicas.

## 9. Eventos Socket.IO relevantes

- `live:create`
- `live:created`
- `live:end`
- `live:ended`
- `live:join`
- `live:joined`
- `live:createTransport`
- `live:transportCreated`
- `live:connectTransport`
- `live:transportConnected`
- `live:produce`
- `live:produced`
- `live:newProducer`
- `live:consume`
- `live:consumed`
- `live:resumeConsumer`
- `live:leave`
- `live:listenerCount`

Esto constituye un protocolo de aplicacion propio sobre Socket.IO.

## 10. Limitaciones y decisiones

- El estado de salas es en memoria; reiniciar el contenedor mata las sesiones.
- No hay grabacion ni transcodificacion server-side.
- `mediasoup` sale del proceso si muere un worker; se privilegia consistencia fuerte sobre recuperacion silenciosa.
- En produccion, `MEDIASOUP_ANNOUNCED_IP` debe ser IP publica real; de lo contrario los peers no podran alcanzar el SFU.

## 11. Resumen

`live-service` implementa una arquitectura WebRTC clasica con SFU:

- Socket.IO para negociar;
- mediasoup para enrutar media;
- JWT/JWKS para controlar acceso;
- REST para discovery de salas;
- puertos RTC dedicados para trafico de audio/video en tiempo real.
