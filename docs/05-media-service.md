# Media Service

## 1. Rol del servicio

`media-service` es el registro binario y de metadata de assets de la plataforma. Maneja:

- audio subido por artistas;
- imagenes de portada y perfil;
- almacenamiento en MinIO;
- metadata embebida como object metadata;
- consulta gRPC interna de metadata;
- publicacion de eventos `media.asset.ready`.

No es un CDN completo ni un transcodificador. Es un servicio de storage y validacion.

## 2. Stack

- `FastAPI`;
- `MinIO` como backend compatible con S3;
- `grpcio`;
- `PyJWT + JWKS`;
- `python-multipart` para uploads;
- `mutagen` para extraer duracion de audio;
- `Pika` para RabbitMQ.

## 3. Flujo de subida de archivo

### 3.1 Entrada HTTP

Endpoints principales:

- `POST /api/v1/media/profile-image`
- `POST /api/v1/media/audio`
- `POST /api/v1/media/images`

Todos pasan por JWT, y ademas:

- audio solo para `ARTIST`;
- `TRACK_COVER` y `ALBUM_COVER` solo para `ARTIST`;
- imagen de perfil para cualquier usuario autenticado.

### 3.2 Validacion

`validation.py` aplica varias barreras:

1. valida MIME declarado;
2. lee el archivo por chunks de 1 MB;
3. corta si excede tamaño maximo;
4. rechaza vacios;
5. valida magic bytes del contenido real.

Esto es importante: no confia en el `Content-Type` del navegador.

Para audio acepta varios contenedores:

- MP3;
- WAV;
- FLAC;
- OGG;
- WebM;
- MP4/M4A.

Para imagen:

- JPEG;
- PNG;
- WEBP.

### 3.3 Extraccion de metadata

Si el asset es audio, `MediaService` intenta calcular `durationSeconds` con `mutagen`. Eso le da a Catalog y Streaming una pista temprana sobre duracion sin tener que inspeccionar el binario cada vez.

### 3.4 Escritura en MinIO

`MinioStorage.upload_asset(...)` guarda:

- binario en `assets/{assetId}`;
- metadata como cabeceras `x-amz-meta-*`.

Metadata guardada:

- `asset-id`;
- `asset-type`;
- `owner-user-id`;
- `original-filename`;
- `size-bytes`;
- `uploaded-at`;
- `duration-seconds` si aplica.

## 4. MinIO como almacenamiento

MinIO expone API S3-compatible. El servicio usa:

- `bucket_exists`;
- `make_bucket`;
- `put_object`;
- `stat_object`;
- `get_object`.

Eso permite:

- escritura binaria;
- lectura por stream;
- metadata asociada al objeto.

En este diseño, la “base de datos” de assets es el propio storage. No hay tabla SQL adicional para assets.

## 5. Lectura de assets y metadata

### Metadata HTTP

`GET /api/v1/media/assets/{asset_id}/metadata` devuelve metadata estructurada para clientes o servicios.

### Binario HTTP

`GET /api/v1/media/assets/{asset_id}` sirve el objeto, pero con una restriccion importante: si el asset es audio, la ruta devuelve 404. La reproduccion de audio real no sale por Media Service; sale por `streaming-service`.

Esa separacion evita que el frontend bypassée las reglas de playback y conteo.

## 6. Servicio gRPC interno

`MediaAssetService.GetAssetMetadata` sirve metadata autorizada a otros microservicios.

Es usado por:

- `catalog-service` para validar covers y audio;
- `identity-service` para validar foto de perfil;
- `streaming-service` para validar portadas de playlists.

La llamada exige metadata `authorization` y reusa el mismo `JwtValidator`.

## 7. Seguridad

### JWT

Usa el mismo patron del resto del ecosistema:

- JWKS cacheado;
- validacion `iss`/`aud`;
- consulta activa a `/api/v1/auth/validate`.

### Ownership

La seguridad no termina en autenticar. El gRPC verifica que:

- el `owner_user_id` del asset coincida con el usuario;
- o el usuario sea `ADMIN`.

Esto es crucial para no permitir que alguien referencie la portada o avatar ajeno.

## 8. Eventos

Tras una subida exitosa, publica `media.asset.ready` en exchange `media.events` con routing key del mismo nombre.

El payload incluye:

- `eventId`;
- `assetId`;
- `assetType`;
- `ownerUserId`;
- `contentType`;
- `sizeBytes`;
- `durationSeconds`;
- `originalFilename`;
- `occurredAt`.

La firma HMAC usa JSON canonico ordenado antes de publicar.

## 9. Que hace cada archivo

- `app/config.py`: puertos, MinIO, limites de tamaño, RabbitMQ, JWT y CORS.
- `app/main.py`: crea app FastAPI, storage, publisher y JWT validator.
- `app/server.py`: ejecuta HTTP y gRPC en el mismo proceso.
- `app/errors.py`: errores controlados y serializacion uniforme.
- `app/media/routes.py`: endpoints REST de upload, metadata y lectura.
- `app/media/service.py`: validacion, extraccion de duracion, escritura en MinIO y publicacion de evento.
- `app/media/validation.py`: validacion profunda de contenido y limites.
- `app/media/schemas.py`: enums y DTOs Pydantic.
- `app/storage/minio_client.py`: adaptador S3-compatible para bucket, write, stat y stream.
- `app/grpc/media_asset_service.py`: servicio gRPC interno de metadata.
- `app/events/publisher.py`: publicacion best-effort de `media.asset.ready`.
- `app/events/signer.py`: serializacion canonica y HMAC.
- `app/auth/jwt_validator.py`: autenticacion RS256 con validacion viva de cuenta.
- `app/auth/models.py`: roles y usuario autenticado.

Pruebas:

- `tests/test_media_service.py`: cobertura del flujo principal.

## 10. Flujos interservicio

### 10.1 Crear track

1. artista sube audio y cover aqui;
2. recibe `assetId`;
3. `catalog-service` valida los ids por gRPC;
4. si pasan, crea la pista.

### 10.2 Foto de perfil

1. usuario sube imagen;
2. Identity valida el `assetId` por gRPC;
3. guarda referencia en `UserProfileEntity`.

### 10.3 Portada de playlist

1. listener sube imagen de playlist;
2. `streaming-service` la valida por gRPC antes de asociarla.

## 11. Decisiones tecnicas

- Separa storage binario de playback para no exponer audio sin control.
- Usa metadata del objeto como indice ligero.
- Prefiere gRPC para validaciones internas por ser simple y tipado.
- La publicacion de eventos es best-effort; la subida no queda bloqueada por RabbitMQ.
