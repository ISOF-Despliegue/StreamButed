# Plataforma Transversal

## 1. Vision global

Fuera de los servicios individuales, el repo tiene piezas fundamentales sin las cuales el sistema no funciona como plataforma:

- `docker-compose.yml` y `docker-compose.prod.yml`;
- `gateway/`;
- `contracts/`;
- `db/init/`;
- `services/` como conjunto;
- `front-streambuted/` empaquetado web/Electron;
- `.env.example`;
- tests globales y reportes;
- `README.md`.

Este documento cubre justo eso: lo que no vive “dentro de un solo servicio” pero es imprescindible entender.

## 2. Infraestructura compartida

### PostgreSQL

Hay dos instancias separadas:

- Identity PostgreSQL;
- Catalog PostgreSQL.

Esto refleja una decision de microservicios clasica: base de datos por servicio, incluso si ambas son Postgres.

Scripts:

- `db/init/identity/01-create-app-user.sh`
- `db/init/catalog/01-create-app-user.sh`

Ambos:

- crean usuario de aplicacion;
- otorgan permisos sobre `public`;
- configuran privilegios por defecto;
- en catalog ademas habilitan `pgcrypto` y `unaccent`.

### MongoDB

Hay dos instancias separadas:

- `streaming-mongo`;
- `analytics-mongo`.

Scripts:

- `db/init/streaming-mongo/01-create-app-user.sh`
- `db/init/analytics-mongo/01-create-app-user.sh`

Crean usuarios `readWrite` especificos por base, reforzando aislamiento.

### RabbitMQ

Es el bus de eventos del ecosistema. Intercambia eventos entre:

- Identity;
- Catalog;
- Streaming;
- Media;
- Analytics.

No se usa como cola de trabajo generica sin semantica. Cada exchange/routing key representa hechos del dominio.

### MinIO

Es el storage binario compartido por:

- `media-service` para escritura y metadata;
- `streaming-service` para lectura de audio;
- consumidores indirectos via gRPC metadata.

## 3. Contratos protobuf compartidos

Carpeta `contracts/`:

- `contracts/catalog/catalog_playback.proto`
- `contracts/media/media_asset.proto`

Estos archivos son el lenguaje comun entre servicios. Evitan que cada uno “adivine” JSON internos.

### Catalog contract

`CatalogPlaybackService.GetPlayableTrack`

Sirve para entregar:

- `track_id`
- `status`
- `audio_asset_id`
- `duration_seconds`
- `exists`

### Media contract

`MediaAssetService.GetAssetMetadata`

Sirve para entregar:

- `asset_id`
- `asset_type`
- `owner_user_id`
- `content_type`
- `size_bytes`
- `exists`

## 4. Orquestacion Compose

`docker-compose.yml` para entorno local y `docker-compose.prod.yml` para produccion muestran la arquitectura real:

- red privada docker;
- `depends_on` con healthchecks;
- exposicion interna de puertos;
- publicacion selectiva a host;
- volumenes persistentes.

### Dependencias clave

- `identity-service` depende de Postgres + RabbitMQ.
- `catalog-service` depende de Postgres + RabbitMQ.
- `media-service` depende de MinIO + RabbitMQ.
- `streaming-service` depende de Mongo + Catalog + MinIO + RabbitMQ.
- `analytics-service` depende de Mongo + Catalog + Identity + RabbitMQ.
- `live-service` depende de Identity.
- `gateway` depende de todos los servicios de negocio.

## 5. Patrones transversales del repo

### JWT descentralizado con JWKS

Se repite en casi todos los servicios:

1. Identity firma con RSA privada;
2. publica JWKS;
3. los demas validan localmente con clave publica;
4. luego consultan `identity-service` para verificar estado de cuenta.

Ventajas:

- no se comparte secreto simetrico global;
- cada servicio puede validar por su cuenta;
- el baneo sigue siendo central.

### Firma HMAC de eventos

Se repite en Media, Streaming, Analytics y Catalog/Identity del lado de RabbitMQ.

Objetivo:

- proteger integridad del payload;
- impedir que un emisor no autorizado inyecte eventos plausibles.

### Outbox

Se usa donde la consistencia evento-BD importa:

- `identity-service`;
- `catalog-service`;
- `streaming-service`.

Es uno de los patrones mas maduros del repo.

### CORS estricto

Varios servicios prohben `*` y exigen lista explicita de origenes. Esto es una postura transversal de seguridad.

## 6. Mapa global de protocolos

### HTTP/REST

Se usa para:

- frontend -> gateway -> microservicios;
- validacion de cuenta;
- JWKS;
- uploads;
- playback;
- dashboards.

### gRPC

Se usa para integraciones internas con contratos estables y payloads pequeños:

- Catalog playback;
- Media metadata;
- Token validator en Identity.

### AMQP / RabbitMQ

Se usa para eventos asincronos del dominio:

- login;
- promocion de artista;
- playback contado;
- snapshots/editorial events;
- asset ready.

### WebRTC

Se usa solo en `live-service` para audio/video en tiempo real.

### S3-compatible object storage

Se usa via MinIO para persistencia binaria.

## 7. Flujos transversales importantes

### Subir y publicar una pista

1. frontend sube audio e imagen a Media.
2. Media guarda en MinIO y devuelve `assetId`.
3. frontend crea la pista en Catalog con esos ids.
4. Catalog valida por gRPC los assets.
5. al reproducir, Streaming consulta Catalog y luego lee MinIO.
6. Analytics cuenta la reproduccion via eventos RabbitMQ.

### Convertir listener en artista

1. usuario pide promocion en Identity.
2. Identity cambia rol y publica evento.
3. Catalog crea o actualiza el `Artist`.
4. frontend artist ya puede editar catalogo.

### Live concert

1. frontend abre socket autenticado al gateway.
2. gateway reenvia a live-service.
3. live-service valida token via JWKS + Identity validate.
4. mediasoup enruta RTP entre artista y listeners.

## 8. Variables de entorno como contrato operativo

`.env.example` es casi un documento de arquitectura:

- puertos;
- secretos;
- endpoints internos;
- issuer/audience JWT;
- targets gRPC;
- nombres de queue;
- limites de media;
- puertos RTC;
- URL del frontend.

Quien despliega la plataforma realmente despliega este contrato.

## 9. Testing y trazabilidad

El repo contiene:

- pruebas unitarias por servicio;
- pruebas frontend;
- reportes locales;
- docs previas como `live-webrtc-production.md`, `message-signing-examples.md`, `FRONTEND_UNIFICACION_BACKEND.md`.

Eso sugiere una base razonablemente madura para mantenimiento.

## 10. Cosas importantes que no se ven a primera vista

- El audio on-demand y el live son dos subsistemas totalmente distintos.
- MinIO es el punto comun entre Media y Streaming.
- Identity es el ancla de confianza de casi todo.
- Catalog es la fuente editorial, no la fuente binaria.
- Analytics no es transaccional; es eventual y proyectado.
- Gateway hace mas que proxy: impone forma publica del sistema.
- El uso combinado de JWKS, validacion viva de cuenta y HMAC de eventos muestra una preocupacion consistente por confianza entre servicios.
