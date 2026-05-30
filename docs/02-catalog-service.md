# Catalog Service

## 1. Responsabilidad del servicio

`catalog-service` administra el catalogo musical de la plataforma:

- artistas;
- albumes;
- tracks;
- busqueda;
- listados administrativos;
- lectura publica de pistas publicadas;
- servidor gRPC interno para playback.

Es el servicio con modelo relacional mas claro y con mayor peso de dominio editorial. El stack es:

- `Node.js 20`;
- `TypeScript`;
- `Express`;
- `Prisma` sobre PostgreSQL;
- `gRPC` para integracion interna;
- `RabbitMQ` para consumir promociones de usuario y publicar eventos de catalogo mediante outbox;
- `JWKS` para autenticar usuarios.

## 2. Arquitectura

La composicion real se observa en `services/catalog-service/src/app.ts`:

- capa `domain`: entidades, enums, repositorios abstractos, value objects;
- capa `application`: casos de uso y servicios de autorizacion/validacion/eventos;
- capa `infrastructure`: Prisma, gRPC client a Media, RabbitMQ, logging;
- capa `interfaces`: HTTP y gRPC de entrada.

Es una arquitectura de puertos y adaptadores relativamente limpia:

- los controladores no conocen SQL;
- los casos de uso no conocen Express;
- los repositorios concretos no conocen el frontend.

## 3. Flujo de arranque

`src/main.ts` hace cuatro cosas importantes:

1. crea la aplicacion HTTP;
2. inicia `IdentityPromotionConsumer`;
3. inicia `CatalogOutboxProcessor`;
4. levanta el servidor gRPC `CatalogPlaybackGrpcServer`.

Por tanto, `catalog-service` no es solo un CRUD REST; tambien es:

- consumidor de eventos desde Identity;
- publicador resiliente hacia RabbitMQ;
- proveedor interno de metadatos de playback.

## 4. Modelo relacional

El esquema Prisma en `prisma/schema.prisma` define:

- `Artist`;
- `Album`;
- `Track`;
- `Outbox`.

### Artist

Representa la identidad editorial del artista dentro del catalogo.

Campos clave:

- `artistId` UUID;
- `displayName`;
- `biography`;
- `profileImageAssetId`.

### Album

Representa una coleccion editorial.

Campos clave:

- `albumId` UUID;
- `artistId`;
- `title`;
- `coverAssetId`;
- `status`.

### Track

Representa la unidad reproducible real.

Campos clave:

- `trackId` UUID;
- `artistId`;
- `albumId` opcional;
- `title`;
- `genre`;
- `audioAssetId`;
- `coverAssetId`;
- `durationSeconds`;
- `status`.

### Outbox

Se usa para desacoplar persistencia transaccional de publicacion AMQP. Cada fila guarda:

- agregado afectado;
- tipo de evento;
- routing key;
- payload JSON;
- estado;
- reintentos;
- timestamps.

## 5. Protocolos e integraciones

### HTTP/1.1

El frontend entra por:

- `/api/v1/catalog/search`;
- `/artists/...`;
- `/albums/...`;
- `/tracks/...`;
- endpoints admin.

### gRPC

`catalog-service` expone `CatalogPlaybackService` definido en `contracts/catalog/catalog_playback.proto`.

Operacion:

- `GetPlayableTrack(track_id)` -> `PlayableTrackResponse`.

Este contrato permite a `streaming-service` validar que una pista:

- existe;
- esta publicada;
- tiene `audio_asset_id`;
- conoce `duration_seconds`.

### RabbitMQ / AMQP

Usa dos direcciones de trafico:

- consume `user.promoted` desde Identity para crear o sincronizar artistas;
- publica eventos de catalogo desde outbox.

### gRPC hacia Media

Antes de aceptar `coverAssetId`, `audioAssetId` o `profileImageAssetId`, valida que el asset exista y sea accesible mediante `GrpcMediaAssetClient`.

## 6. Seguridad y autorizacion

La autenticacion se monta con `createAuthenticationMiddleware(...)`.

El flujo es:

1. leer token Bearer;
2. resolver clave publica desde JWKS;
3. validar firma RS256, issuer y audience;
4. consultar estado de cuenta en Identity;
5. adjuntar `authenticatedUser` al request.

Luego `AuthorizationService` controla reglas de dominio, por ejemplo:

- solo artista dueño o admin pueden editar recursos;
- endpoints administrativos requieren privilegios elevados.

## 7. Busqueda y lectura publica

La busqueda usa SQL con `unaccent(lower(...))`, visible en repositorios Prisma con `$queryRaw`.

Esto resuelve dos necesidades:

- coincidencia case-insensitive;
- tolerancia a acentos.

Es importante porque la UX de catalogo musical depende de encontrar resultados aunque el usuario escriba sin tildes.

## 8. Eventos y consistencia

El servicio graba cambios editoriales y luego los publica por outbox. Este patron evita el problema clasico:

- si guardas en BD y luego falla RabbitMQ, el cambio se pierde a nivel de eventos;
- si publicas y luego falla la BD, emites un hecho que nunca existio realmente.

Con outbox:

1. se persiste el cambio de dominio;
2. se persiste la fila `Outbox` en la misma base;
3. un procesador aparte publica;
4. al confirmar, marca `processed`.

## 9. Que hace cada archivo principal

### Arranque y ensamblado

- `src/main.ts`: boot principal, arranque HTTP, gRPC y procesos de mensajeria.
- `src/app.ts`: composicion de dependencias, middlewares, repositorios, casos de uso y routers.

### HTTP

- `src/interfaces/http/routes/CatalogRoutes.ts`: mapa completo de rutas REST.
- `src/interfaces/http/controllers/CatalogController.ts`: adapta requests/responses a casos de uso.
- `src/interfaces/http/middleware/AuthenticationMiddleware.ts`: valida JWT y adjunta usuario autenticado.
- `src/interfaces/http/middleware/ErrorHandlerMiddleware.ts`: unifica manejo de errores y 404.
- `src/interfaces/http/middleware/ValidateRequest.ts`: validacion de request contra esquemas.
- `src/interfaces/http/schemas/CatalogSchemas.ts`: contratos Zod para query, params y body.

### gRPC

- `src/interfaces/grpc/CatalogPlaybackGrpcServer.ts`: servidor interno para `GetPlayableTrack`.

### Aplicacion

- `src/application/services/AuthorizationService.ts`: reglas de autorizacion de negocio.
- `src/application/services/MediaAssetValidator.ts`: contrato para validar assets remotos.
- `src/application/services/CatalogEventRecorder.ts`: abstraccion para registrar eventos de catalogo.

### Casos de uso de tracks

- `CreateTrackUseCase.ts`: crea pista y valida artista/album/assets.
- `UpdateTrackUseCase.ts`: actualiza metadata y assets.
- `RetireTrackUseCase.ts`: retira una pista del catalogo publico.
- `GetTrackByIdUseCase.ts`: lectura puntual.
- `ListArtistTracksUseCase.ts`: lista por artista.
- `ListAdminTracksUseCase.ts`: listado moderativo.
- `ListPublishedTracksByIdsUseCase.ts`: batch publico para library y playback.

### Casos de uso de albums

- `CreateAlbumUseCase.ts`: alta editorial del album.
- `UpdateAlbumUseCase.ts`: cambia titulo o portada.
- `RetireAlbumUseCase.ts`: retira album y coordina con tracks.
- `GetAlbumByIdUseCase.ts`: detalle puntual.
- `ListAlbumTracksUseCase.ts`: listado reproducible por album.
- `ListArtistAlbumsUseCase.ts`: discografia publica por artista.
- `ListAdminAlbumsUseCase.ts`: consulta moderativa.

### Casos de uso de artistas

- `GetArtistByIdUseCase.ts`: perfil publico.
- `UpdateArtistProfileUseCase.ts`: modifica display name, bio e imagen.
- `HandleUserPromotedUseCase.ts`: refleja en Catalog una promocion de LISTENER a ARTIST emitida por Identity.

### Busqueda

- `SearchCatalogUseCase.ts`: orquesta busqueda global entre artistas, albumes y tracks.

### Infraestructura de persistencia

- `src/infrastructure/prisma/prismaClient.ts`: cliente Prisma singleton.
- `PrismaArtistRepository.ts`: CRUD y busqueda de artistas.
- `PrismaAlbumRepository.ts`: CRUD, busqueda y listados de albumes.
- `PrismaTrackRepository.ts`: CRUD, busqueda, lotes y listados de tracks.

### Infraestructura gRPC

- `GrpcMediaAssetClient.ts`: valida contra `media-service` que un asset existe, pertenece y tiene metadata valida.

### Infraestructura de mensajeria

- `CatalogEventOutbox.ts`: persiste eventos en tabla outbox.
- `CatalogOutboxProcessor.ts`: publica desde outbox a RabbitMQ, con reintentos y recuperacion.
- `IdentityPromotionConsumer.ts`: escucha promociones de artista provenientes de Identity.

### Dominio

- `src/domain/entities/*.ts`: forma canonica de Artist, Album y Track.
- `src/domain/enums/CatalogStatus.ts`: `PUBLICADO` o `RETIRADO`.
- `src/domain/repositories/*.ts`: contratos del dominio.
- `src/domain/valueObjects/Pagination.ts`: encapsula `limit/offset`.

### Soporte

- `src/infrastructure/logging/logger.ts`: logger del servicio.
- `prisma/schema.prisma`: modelo relacional y outbox.
- `prisma/migrations/*`: evolucion real del esquema.

## 10. Flujos de negocio relevantes

### 10.1 Crear track

1. frontend sube audio/imagen a `media-service`;
2. recibe `assetId`;
3. manda `POST /catalog/tracks` o `/albums/{albumId}/tracks`;
4. `catalog-service` autentica al usuario;
5. valida ownership y rol;
6. verifica que audio y cover existan en Media;
7. persiste track en PostgreSQL;
8. registra evento en outbox.

### 10.2 Promocion a artista

1. `identity-service` publica `user.promoted`;
2. `IdentityPromotionConsumer` lo recibe;
3. `HandleUserPromotedUseCase` hace upsert de `Artist`;
4. el artista ya puede tener perfil editorial en Catalog.

### 10.3 Playback interno

1. `streaming-service` consulta `GetPlayableTrack`;
2. Catalog responde con metadata minima;
3. Streaming decide si puede emitir audio.

## 11. Decisiones tecnicas clave

- PostgreSQL se usa porque el dominio editorial requiere integridad relacional y referencias fuertes.
- Prisma simplifica persistencia pero se complementa con SQL manual para busqueda con `unaccent`.
- gRPC evita sobrecoste de payload y estandariza integracion interna de playback.
- Outbox reduce riesgo de inconsistencia entre BD y RabbitMQ.
