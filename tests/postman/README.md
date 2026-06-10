# Postman / Newman Tests

## Que es Postman en este proyecto

Postman se usa para probar los endpoints HTTP de StreamButed pasando por el gateway local en `http://localhost`. Estas pruebas no reemplazan los tests unitarios de cada servicio; verifican integracion, contratos basicos, autenticacion y flujos funcionales entre servicios.

## Que es Newman

Newman es el runner de linea de comandos para colecciones Postman. Permite correr las mismas colecciones desde Windows PowerShell, CI o scripts npm.

## Archivos

- `StreamButed-Current-Auth-Smoke.postman_collection.json`: coleccion smoke actual y estable.
- `StreamButed-Full-Flow.postman_collection.json`: coleccion funcional de extremo a extremo con JWT valido y datos reproducibles.
- `StreamButed-Identity-Catalog.postman_collection.json`: coleccion legacy.
- `StreamButed.local.postman_environment.json`: environment local compartido.
- `fixtures/profile-image.png`: fixture para prueba negativa multipart sin JWT.
- `fixtures/postman-cover.webp`: fixture pequeno para uploads de imagen.
- `fixtures/postman-audio.mp3`: fixture pequeno para uploads de audio.

## Smoke vs Full Flow

`StreamButed-Current-Auth-Smoke.postman_collection.json` es la coleccion principal para verificar que el backend este levantado. Cubre health checks, endpoints publicos, endpoints protegidos sin JWT, registro pendiente por verificacion de correo y casos negativos basicos. Esta pensada para correr siempre y no depende de usuarios semilla verificados.

`StreamButed-Full-Flow.postman_collection.json` cubre flujos funcionales con JWT valido: login de artista semilla, validate, `/users/me`, refresh, uploads de Media, CRUD funcional de Catalog, Playback, Library, Analytics y Live. Esta suite necesita datos semilla y debe fallar cuando el backend devuelve `500` donde el contrato esperado es `200`, `201` o `404`.

`StreamButed-Identity-Catalog.postman_collection.json` queda como legacy. Esta desactualizada para el flujo actual porque espera que `POST /register` cree el usuario y entregue tokens inmediatamente. Hoy el registro responde pending y requiere un codigo enviado por correo.

## Importar En Postman

1. Abre Postman.
2. Usa `Import`.
3. Importa:
   - `tests/postman/StreamButed-Current-Auth-Smoke.postman_collection.json`
   - `tests/postman/StreamButed-Full-Flow.postman_collection.json`
   - `tests/postman/StreamButed-Identity-Catalog.postman_collection.json`
   - `tests/postman/StreamButed.local.postman_environment.json`
4. Selecciona el environment `StreamButed Local`.
5. Ejecuta primero `StreamButed - Current Auth Smoke Integration`.
6. Ejecuta `StreamButed - Full Flow Integration` solo cuando tengas configurado el usuario artista semilla.

## Ejecutar Desde PowerShell

Desde la raiz del repositorio:

```powershell
docker compose up -d --build
docker compose ps
```

Smoke:

```powershell
npm run test:postman:smoke
```

Full flow:

```powershell
npm run test:postman:full
```

Alias actual:

```powershell
npm run test:postman
```

`npm run test:postman` ejecuta la smoke. La full flow se ejecuta explicitamente con `npm run test:postman:full`.

Comandos equivalentes con Newman:

```powershell
npx --yes newman run tests/postman/StreamButed-Current-Auth-Smoke.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json --working-dir .
npx --yes newman run tests/postman/StreamButed-Full-Flow.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json --working-dir .
```

## Servicios Requeridos

Antes de correr Newman deben estar levantados y healthy:

- `gateway`
- `identity-service`
- `catalog-service`
- `media-service`
- `streaming-service`
- `analytics-service`
- `live-service`
- Dependencias de compose: PostgreSQL, MongoDB, RabbitMQ y MinIO.

Para diagnosticar desde PowerShell:

```powershell
docker compose ps
docker compose logs identity-service
docker compose logs catalog-service
```

## Datos Semilla Para Full Flow

La full flow requiere un artista reproducible:

- `seedArtistEmail`: email de usuario verificado.
- `seedArtistPassword`: password del usuario.
- El usuario debe tener rol `ARTIST` en Identity.
- Catalog debe tener la proyeccion/registro de artista correspondiente; normalmente esto depende del evento de promocion a artista o de un seed de base de datos.

Opcionales:

- `seedListenerEmail` y `seedListenerPassword`: habilitan checks de oyente en Live.
- `seedAdminEmail` y `seedAdminPassword`: obtienen `adminAccessToken` para Analytics admin.
- `adminAccessToken`: alternativa si ya tienes un token admin valido.
- `seedTrackId`: fallback para Playback/Library si Catalog aun no puede crear tracks en local.

No se inventa ningun codigo de verificacion por correo. Si SMTP no esta configurado, la smoke documenta la limitacion y la full flow debe usar un usuario semilla ya verificado.

Seed local usado por defecto:

- `seedArtistEmail`: `postman.artist@example.test`
- `seedArtistPassword`: no se versiona; pasalo desde Postman o Newman como variable local.
- `artistId`: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`

Si borras volumenes de Docker, reconstruye el seed local desde PowerShell. Define primero una password local que cumpla la politica del backend, sin subirla al repositorio:

```powershell
$env:POSTMAN_SEED_PASSWORD = "define-una-password-local"
docker compose exec identity-postgres psql -U streambuted -d streambuted_identity -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"
docker compose exec identity-postgres psql -U streambuted -d streambuted_identity -v ON_ERROR_STOP=1 -v seed_password="$env:POSTMAN_SEED_PASSWORD" -c "WITH upsert_account AS (INSERT INTO user_account (id, email, password_hash, role, is_active, password_setup_required, created_at, updated_at) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'postman.artist@example.test', crypt(:'seed_password', gen_salt('bf', 12)), 'ARTIST', true, false, now(), now()) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ARTIST', is_active = true, password_setup_required = false, banned_at = null, banned_until = null, ban_reason = null, updated_at = now() RETURNING id) INSERT INTO user_profile (id, account_id, username, bio, created_at, updated_at) SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'postman-artist', 'Local Postman artist seed', now(), now() FROM upsert_account ON CONFLICT (account_id) DO UPDATE SET username = 'postman-artist', bio = 'Local Postman artist seed', updated_at = now() RETURNING account_id, username"
docker compose exec catalog-postgres psql -U streambuted -d streambuted_catalog -v ON_ERROR_STOP=1 -c "INSERT INTO artist (artist_id, display_name, biography, created_at, updated_at) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'postman-artist', 'Local Postman artist seed', now(), now()) ON CONFLICT (artist_id) DO UPDATE SET display_name = 'postman-artist', biography = 'Local Postman artist seed', updated_at = now() RETURNING artist_id, display_name"
npm run test:postman:full -- --env-var "seedArtistPassword=$env:POSTMAN_SEED_PASSWORD"
```

## Variables Del Environment

El environment local define `baseUrl = http://localhost` y conserva bases por servicio:

- `identityBaseUrl`
- `catalogBaseUrl`
- `mediaBaseUrl`
- `playbackBaseUrl`
- `libraryBaseUrl`
- `analyticsBaseUrl`
- `liveBaseUrl`

Variables de tokens y usuarios:

- `accessToken`
- `refreshToken`
- `artistAccessToken`
- `listenerAccessToken`
- `adminAccessToken`
- `userId`
- `artistId`
- `listenerId`

Variables de recursos:

- `albumId`
- `trackId`
- `assetId`
- `albumCoverAssetId`
- `trackCoverAssetId`
- `playlistCoverAssetId`
- `audioAssetId`
- `playlistId`
- `liveRoomId`
- `playbackTrackId`
- `playbackToken`
- `streamUrl`

Variables dinamicas:

- `runSuffix`
- `albumTitle`
- `updatedAlbumTitle`
- `trackTitle`
- `playlistName`
- `liveRoomTitle`

## Cobertura Full Flow

La coleccion full flow incluye 45 requests:

- Auth: login de artista semilla, validate, `/users/me`, refresh, login admin/listener opcional y logout.
- Media: upload de portada de album, portada de track, audio y rechazo sin JWT.
- Catalog: crear album, consultar album, editar album, crear track, consultar track, buscar, y album inexistente esperado como `404`.
- Playback: rechazo sin JWT, crear stream session, guardar progreso, consultar progreso, latest progress y stream parcial con playback token.
- Library: consultar biblioteca, like/unlike de track, subir cover de playlist, crear playlist, agregar y remover track.
- Analytics: discovery publico, resumen privado del artista, rechazo de admin summary con artista y admin summary opcional.
- Live: health, OpenAPI, rechazo sin JWT, crear sala, listar salas, detalle de sala y listado opcional con listener.

## Limitaciones Pendientes

- Newman no tiene una forma deterministica de leer el codigo de verificacion enviado por correo; por eso la full flow usa un usuario artista semilla.
- La full flow requiere MinIO operativo para uploads reales de Media.
- Si Catalog no tiene migraciones/proyecciones correctas, los pasos de album/track pueden fallar y Playback/Library usaran `seedTrackId` solo si esta configurado.
- Live cubre REST HTTP. Socket.IO/WebRTC no se automatiza con Postman y requiere pruebas manuales o e2e con navegador.
- La coleccion legacy debe actualizarse o reemplazarse cuando exista una estrategia automatizable para verificar email.
