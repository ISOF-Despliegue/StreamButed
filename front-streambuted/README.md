# StreamButed Frontend

Frontend React + TypeScript + Vite + Electron de StreamButed.

## Estado actual

La primera unificacion real con backend ya esta aplicada.

Servicios conectados por Gateway:

- Identity Service
- Catalog Service
- Media Service

Servicios pendientes:

- Analytics Service
- Live Service
- Streaming / Playback Service

El frontend ya no usa `src/data/mockData.js` ni credenciales demo en pantallas productivas.

## Configuracion

Crear `.env` desde `.env.example` si hace falta:

```env
VITE_API_BASE_URL=http://localhost
```

El backend se consume por Gateway:

```txt
http://localhost/api/v1
```

Para desarrollo local, el backend debe permitir estos origenes:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost
```

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand
```

Electron:

```bash
npm run build:electron
npm run electron
```

## Arquitectura relevante

```txt
src/
  app/AppProviders.tsx
  context/AuthContext.tsx
  hooks/useAuth.ts
  routes/ProtectedRoute.tsx
  routes/RoleRoute.tsx
  services/apiClient.ts
  services/authTokenStore.ts
  services/authService.ts
  services/userService.ts
  services/catalogService.ts
  services/mediaService.ts
  types/
  pages/
  components/
```

`StreamButed.tsx` conserva la navegacion por estado local, pero sesion, tokens y llamadas HTTP ya viven fuera de ese archivo.

## Sesion y seguridad

- Access token solo en memoria.
- Refresh token por cookie HttpOnly del backend.
- Todas las peticiones usan `credentials: "include"`.
- `Authorization` se adjunta desde `apiClient`.
- No se usa `localStorage` ni `sessionStorage` para tokens.
- No se consume `/media/assets/{assetId}/metadata`.

## Pantallas conectadas

- Login
- Registro
- Perfil
- Promocion a artista
- Search
- Detalle de artista
- Detalle de album
- Dashboard de artista
- Mis pistas
- Mis albums
- Upload Single
- Create Album
- Edit Track

## Uploads conectados

El frontend sube archivos a Media con `FormData`; `apiClient` no fija manualmente `Content-Type`, para que el navegador agregue el boundary de `multipart/form-data`.

Flujos activos:

```txt
Perfil:
POST /api/v1/media/profile-image
PUT  /api/v1/users/me { profileImageAssetId }

Album:
POST /api/v1/media/images usage=ALBUM_COVER
POST /api/v1/catalog/albums

Track:
POST /api/v1/media/audio
POST /api/v1/media/images usage=TRACK_COVER
POST /api/v1/catalog/tracks

Track dentro de album:
POST /api/v1/media/audio
POST /api/v1/media/images usage=TRACK_COVER
POST /api/v1/catalog/albums/{albumId}/tracks
```

El formulario de cancion captura `genre` y permite elegir si la pista queda como single o se agrega a un album existente. Desde `Mis albums` se puede crear album, retirar album y abrir la carga de cancion con el album preseleccionado.

Audio aceptado desde la UI: MP3, WAV, FLAC, OGG y WEBM hasta 200 MB. Imagenes de perfil y portadas: JPG, PNG o WEBP hasta 5 MB. El gateway permite cuerpos hasta 256 MB y Media valida los limites reales.

## Placeholders honestos

Estas vistas no muestran datos falsos:

- Home/recomendaciones
- Library
- Lives
- Artist Analytics
- Admin Users
- Admin Moderation
- Admin Reports
- Player real

El player esta preparado, pero no simula streaming ni progreso hasta que exista Streaming/Playback Service.

## Documentacion relacionada

```txt
../docs/FRONTEND_UNIFICACION_BACKEND.md
../docs/FRONTEND_SERVICIOS.md
../docs/FRONTEND_MOCKS.md
```
