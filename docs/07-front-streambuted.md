# Front StreamButed

## 1. Naturaleza del modulo

`front-streambuted` es el cliente principal de la plataforma y tambien puede empaquetarse como aplicacion Electron. Su stack es:

- `React 19`;
- `react-router-dom`;
- `Vite`;
- `Socket.IO Client`;
- `mediasoup-client`;
- `Jest + Testing Library`;
- `Electron`.

No es un simple renderizado de pantallas. Orquesta:

- autenticacion;
- renovacion de sesion;
- navegacion por rol;
- busqueda;
- catalogo;
- biblioteca;
- playback on-demand;
- live WebRTC;
- modo escritorio.

## 2. Punto de entrada

- `src/main.tsx`: monta React en `#root`.
- `src/App.tsx`: decide `BrowserRouter` o `HashRouter` segun si corre bajo `file:` en Electron.
- `src/StreamButed.tsx`: contenedor grande con rutas, reproductor global, overlays, toasts y logica de playback.

La eleccion `HashRouter` en Electron evita depender de configuracion extra de servidor para rutas profundas.

## 3. Arquitectura funcional

### Providers

`AppProviders` envuelve el arbol con contextos, especialmente:

- `AuthProvider`;
- `LiveContext` o equivalentes de tiempo real.

### Services

La carpeta `src/services` encapsula acceso a backend:

- `apiClient.ts`: cliente HTTP base;
- `authService.ts`;
- `catalogService.ts`;
- `libraryService.ts`;
- `playbackService.ts`;
- `mediaService.ts`;
- `analyticsService.ts`;
- `userService.ts`.

### Hooks

La carpeta `src/hooks` encapsula coordinacion:

- `useAuth`;
- `useLiveSocket`;
- `useArtistLive`;
- `useListenerLive`;
- `useSearchController`.

### Pages

Las rutas se agrupan por dominio de usuario:

- listener;
- artist;
- admin;
- auth;
- live;
- settings.

## 4. Flujo de autenticacion en cliente

`AuthContext.tsx` mantiene:

- `user`;
- `accessToken`;
- `isLoadingSession`.

Flujo:

1. al arrancar, intenta `authService.refresh()`;
2. si obtiene access token, lo guarda con `authTokenStore`;
3. consulta `userService.getCurrentUser()`;
4. si algo falla, limpia sesion.

`apiClient.ts` implementa un flujo importante:

- adjunta Bearer token;
- si recibe `401/403`, intenta refresh una sola vez;
- si hay baneo, dispara `SESSION_TERMINATED_EVENT`;
- limpia token local y obliga a la UI a caer a estado no autenticado.

## 5. Playback en frontend

`StreamButed.tsx` contiene un `PlaybackController` global con:

- elemento `HTMLAudioElement` en `ref`;
- pista actual;
- cola de reproduccion;
- posicion;
- duracion;
- volumen;
- repeat/shuffle;
- guardado de progreso cada ~10 segundos.

### Flujo de reproduccion

1. usuario selecciona track;
2. frontend llama `playbackService.createStreamSession(trackId)`;
3. obtiene `streamUrl`;
4. asigna `audio.src = streamUrl`;
5. hace `audio.play()`;
6. consulta y restaura progreso previo;
7. envia updates de progreso a backend.

### Cola

`utils/playbackQueue.ts` construye colas tipo:

- pista unica;
- album;
- shuffle.

La cola no solo decide “siguiente”; tambien mantiene identidad del origen para habilitar controles como “anterior”, “shuffle del album” y “repetir”.

## 6. Biblioteca en frontend

`LibraryPage.jsx` y `libraryService.ts` coordinan:

- resumen de biblioteca;
- liked songs;
- playlists;
- agregar o quitar tracks;
- detalle de playlist.

Como la metadata editorial vive en Catalog, el frontend trabaja con respuestas ya enriquecidas desde `streaming-service`.

## 7. Catalogo y panel artist/admin

### Listener

Paginas listener consumen:

- busqueda publica;
- artista;
- album;
- detalle de pistas.

### Artist

Paginas artist orquestan:

- actualizacion de perfil editorial;
- subida de audio e imagen a `media-service`;
- creacion y edicion de albumes/tracks;
- lectura de analitica por artista.

### Admin

Paginas admin permiten:

- ver analitica global;
- retirar albumes/pistas;
- suspender o reactivar cuentas.

## 8. Cliente Live: Socket.IO + mediasoup-client

### Conexion base

`useLiveSocket.ts` abre socket contra el gateway:

- URL base del gateway;
- path `/live/ws/socket.io/`;
- `auth: { token }`;
- reconexion habilitada.

### Artista

`useArtistLive.ts`:

1. pide camara y microfono;
2. crea `Device` de mediasoup-client;
3. negocia transporte `send`;
4. produce `audio` y `video`;
5. mantiene `Producer` refs;
6. escucha conteo de listeners.

### Listener

`useListenerLive.ts`:

1. negocia `Device`;
2. crea transporte `recv`;
3. consume cada `producerId`;
4. agrega `consumer.track` a `MediaStream`;
5. lo expone a la UI para reproducirlo en `<video>` o `<audio>`.

## 9. Transmision de video y microfono desde el navegador

El frontend es quien captura origenes fisicos reales.

### Microfono

`getUserMedia` usa:

- cancelacion de eco;
- supresion de ruido;
- sample rate 48 kHz.

Eso alinea al navegador con Opus, que es ideal para voz y audio interactivo.

### Camara

Pide video ideal 1280x720 a 30 fps. Luego `mediasoup-client` y el navegador codifican a VP8 antes del envio RTP.

### Bitrate y encodings

El productor de video define tres escalas de bitrate, lo que ayuda a la adaptacion a red. Aunque el repo no implementa una capa compleja de ABR manual, si prepara el envio para diferentes condiciones.

## 10. Modo Electron

- `electron/main.ts`: crea `BrowserWindow`, oculta menu, habilita `preload`, abre devtools en modo dev.
- `electron/preload.ts`: expone API minima segura por `contextBridge`.

Con `contextIsolation: true`, `nodeIntegration: false` y `sandbox: true`, el renderer se mantiene relativamente aislado.

## 11. Que hace cada grupo de archivos

### Nucleo

- `src/main.tsx`, `src/App.tsx`, `src/StreamButed.tsx`

### Contexto y auth

- `src/context/AuthContext.tsx`
- `src/context/authContextValue.ts`
- `src/hooks/useAuth.ts`

### Live

- `src/context/LiveContext.tsx`
- `src/hooks/useLive.ts`
- `src/hooks/useLiveSocket.ts`
- `src/hooks/useArtistLive.ts`
- `src/hooks/useListenerLive.ts`
- `src/pages/live/*`

### Servicios HTTP

- `src/services/apiClient.ts`
- `src/services/authService.ts`
- `src/services/catalogService.ts`
- `src/services/libraryService.ts`
- `src/services/playbackService.ts`
- `src/services/mediaService.ts`
- `src/services/analyticsService.ts`
- `src/services/userService.ts`

### Rutas y guards

- `src/routes/appRoutes.ts`
- `src/routes/ProtectedRoute.tsx`
- `src/routes/RoleRoute.tsx`

### Layout y playback

- `src/components/layout/BottomPlayer.jsx`
- `ExpandedPlayer.jsx`
- `Sidebars.jsx`
- `TrackLibraryActions.jsx`

### Utilidades y tipos

- `src/utils/*`
- `src/types/*`

### Estilos

- `src/index.css`
- `src/App.css`

### Testing

- `*.test.tsx` y `*.test.ts` cubren auth, servicios, rutas, playback y componentes clave.

## 12. Decisiones importantes

- El reproductor es global, no local a una pagina, para no cortar audio al navegar.
- `apiClient` centraliza refresh y cierre de sesion por baneo.
- El live usa un socket persistente separado del playback HTTP.
- Electron reutiliza el mismo renderer web, minimizando divergencia entre plataformas.
