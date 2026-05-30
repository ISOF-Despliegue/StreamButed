# Streaming Service

## 1. Papel del servicio

`streaming-service` implementa el consumo on-demand:

- emite sesiones de stream;
- sirve audio real por HTTP;
- procesa `Range`;
- persiste progreso de reproduccion;
- mantiene biblioteca del usuario;
- publica eventos de reproduccion contada;
- consulta `catalog-service` y `media-service`.

Es el servicio que convierte una pista editorial en una experiencia reproducible.

## 2. Stack

- `FastAPI`;
- `MongoDB` con `Motor`;
- `MinIO`;
- `gRPC` clients;
- `RabbitMQ`;
- JWT RS256 para autenticacion de usuario;
- JWT HS256 separado para playback tokens efimeros.

## 3. Dos problemas distintos que resuelve

### Playback

Necesita entregar bytes de audio de forma eficiente y compatible con el elemento `<audio>` del navegador.

### Library

Necesita guardar estado usuario-catalogo:

- liked songs;
- playlists;
- progreso;
- ultima escucha.

Por eso el servicio mezcla playback y biblioteca, ambos muy ligados a la experiencia de escucha.

## 4. Flujo de reproduccion real

### 4.1 Crear stream session

`POST /api/v1/playback/tracks/{trackId}/stream-session`

Pasos:

1. valida JWT del usuario;
2. consulta a `catalog-service` por gRPC `GetPlayableTrack`;
3. confirma que la pista este publicada y tenga `audio_asset_id`;
4. emite playback token HS256 de vida corta;
5. responde `streamUrl` con `playbackToken`.

### 4.2 Descargar audio

`GET /api/v1/playback/tracks/{trackId}/stream?playbackToken=...`

Pasos:

1. valida playback token HS256 o Bearer token;
2. vuelve a consultar Catalog para asegurar que la pista sigue siendo reproducible;
3. lee metadata del objeto en MinIO;
4. parsea `Range` si existe;
5. abre stream sobre MinIO;
6. responde:
   - `200` si no hay rango;
   - `206 Partial Content` si hay rango valido;
   - `416` si el rango no se puede satisfacer.

## 5. Transmision de bits en audio on-demand

Aqui no hay WebRTC. El audio se sirve como flujo HTTP de bytes.

### HTTP Range

El header `Range: bytes=start-end` permite que el navegador:

- haga seek;
- reintente descargas parciales;
- continue reproduccion sin bajar el archivo completo desde cero.

`parse_range_header()` implementa una version RFC-friendly:

- acepta un solo rango;
- soporta sufijos `bytes=-500`;
- calcula `Content-Range`;
- valida limites contra `size_bytes`.

### Streaming desde MinIO

`MinioAudioStorage.open_audio(...)` abre el objeto con offset y length, luego lo entrega como iterador de chunks.

Esto significa:

- el servidor no carga todo el audio a RAM;
- transmite por bloques;
- el navegador recibe un flujo continuo de bytes.

En otras palabras, el audio no “viaja como pista” a nivel logico, sino como secuencia de bytes de un objeto binario, con headers HTTP que explican que tramo del recurso representa ese flujo.

## 6. Playback token separado del access token

`PlaybackTokenService` usa HS256 y un secreto propio:

- `sub = userId`;
- `trackId`;
- `purpose = playback_stream`;
- `iat`;
- `exp`.

Esto permite compartir con el reproductor una URL efimera sin exponer permanentemente el Bearer principal. El token esta atado a una pista concreta y a una ventana corta.

## 7. Progreso y conteo de reproduccion

`PlaybackService.update_progress(...)` guarda progreso y decide si una escucha ya es contable.

Flujo:

1. upsert de progreso en Mongo;
2. si `position_seconds >= STREAMING_VALID_PLAYBACK_SECONDS`, intenta marcar reproduccion contada;
3. si se cuenta por primera vez, genera evento `TrackPlaybackCounted`.

Eso evita duplicar plays infinitamente por cada heartbeat.

## 8. Outbox de playback

El servicio usa un outbox en Mongo para no perder eventos si RabbitMQ cae.

`MongoPlaybackEventOutbox`:

- deduplica por `event_id`;
- guarda `status`, `retry_count`, `created_at`, `processed_at`.

`PlaybackEventOutboxProcessor`:

- corre cada cierto intervalo;
- reintenta pendientes;
- reinyecta fallidos viejos;
- marca `PROCESSED` o `FAILED`.

## 9. Biblioteca del usuario

Aunque el detalle del repositorio esta partido en varios archivos, la semantica es clara:

- playlists privadas de usuario;
- playlist de sistema para liked songs;
- items de playlist con `position`;
- resumen de biblioteca;
- detalle de playlist;
- like/unlike de track.

Mongo encaja bien porque:

- la estructura es muy orientada a usuario;
- no necesita join fuerte con catalogo;
- el enriquecimiento de metadata se hace por consultas a Catalog y Media.

## 10. Integraciones internas

### Catalog

`CatalogClient` hace dos cosas:

- gRPC para `GetPlayableTrack`;
- HTTP batch para `tracks/batch` y metadata publica en biblioteca.

### Media

`MediaAssetClient` consulta metadata de assets por gRPC, por ejemplo para validar covers de playlists.

### MinIO

Lee audio binario y metadata del archivo.

## 11. Que hace cada archivo principal

### Arranque

- `app/config.py`: puertos, Mongo, MinIO, JWT, RabbitMQ, gRPC targets y playback token secret.
- `app/main.py`: compone repositorios, clientes, outbox, servicios y routers.
- `app/server.py`: arranca Uvicorn.
- `app/errors.py`: errores HTTP y `RangeNotSatisfiableError`.

### Playback

- `app/playback/routes.py`: API de sesiones, stream y progreso.
- `app/playback/service.py`: sesion efimera, stream real, progreso y publish de evento.
- `app/playback/token_service.py`: HS256 de playback.
- `app/playback/ranges.py`: parseo y validacion de `Range`.
- `app/playback/schemas.py`: DTOs REST.

### Storage

- `app/storage/minio_audio_storage.py`: stat y stream por byte-range desde MinIO.

### Biblioteca

- `app/library/routes.py`: endpoints de playlists, likes y resumen.
- `app/library/service.py`: reglas de biblioteca y enriquecimiento de metadata.
- `app/library/repository.py`: persistencia Mongo de playlists/items.
- `app/library/schemas.py`: contratos de biblioteca.

### Progreso

- `app/progress/repository.py`: progreso por usuario/pista y marcacion de play contado.

### Eventos

- `app/events/publisher.py`: publicador RabbitMQ o noop/outbox.
- `app/events/outbox.py`: outbox Mongo y relay async.
- `app/events/signer.py`: JSON canonico + HMAC.

### Integracion

- `app/catalog/client.py`: gRPC/HTTP hacia Catalog.
- `app/media/client.py`: gRPC hacia Media.
- `app/grpc/generated/*`: stubs protobuf generados.

### Seguridad

- `app/auth/jwt_validator.py`: Bearer RS256 via JWKS.
- `app/auth/models.py`: roles y sujeto autenticado.

Pruebas:

- `tests/test_streaming_service.py`
- `tests/test_library_repository.py`

## 12. Flujos clave

### 12.1 Reproducir una pista

1. frontend pide stream session;
2. backend devuelve URL efimera;
3. `<audio>` descarga bytes por HTTP;
4. frontend reporta progreso periodicamente;
5. al rebasar umbral, se emite evento a Analytics.

### 12.2 Seek

1. usuario mueve la barra;
2. el navegador vuelve a solicitar bytes cercanos al offset temporal;
3. `Range` permite leer solo el tramo necesario;
4. no se reinicia toda la descarga.

### 12.3 Biblioteca

1. usuario marca like o edita playlists;
2. Mongo persiste ids y orden;
3. el servicio consulta Catalog para completar titulo, portada, artista y duracion.

## 13. Decisiones tecnicas

- separar access token y playback token reduce superficie de riesgo;
- `Range` es obligatorio para una UX de audio seria;
- outbox protege metricas ante caidas de RabbitMQ;
- Mongo reduce friccion para estado por usuario y progresos mutables.
