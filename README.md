# StreamButed

Monorepo de microservicios de StreamButed con orquestacion centralizada en la raiz.

## Servicios incluidos en el compose maestro

- `identity-postgres` (PostgreSQL 16.2-alpine)
- `catalog-postgres` (PostgreSQL 16.2-alpine)
- `rabbitmq` (RabbitMQ 3.12-management-alpine)
- `minio` (almacenamiento de assets)
- `streaming-mongo` (MongoDB 7.0 para progreso de reproduccion)
- `identity-service`
- `catalog-service`
- `media-service`
- `streaming-service`
- `gateway` (nginx)

## Bases de datos

Cada microservicio usa su propia instancia PostgreSQL y su propio volumen de persistencia:

- `identity-postgres`: crea la base `${POSTGRES_IDENTITY_DB}` y persiste en `identity_postgres_data`.
- `catalog-postgres`: crea la base `${POSTGRES_CATALOG_DB}` y persiste en `catalog_postgres_data`.

Los servicios se conectan por la red interna de Docker usando el puerto `5432` de cada contenedor.
Los puertos publicados en el host son configurables con `POSTGRES_IDENTITY_PORT` y `POSTGRES_CATALOG_PORT`.

`streaming-service` usa MongoDB propio (`streaming-mongo`) para `playback_progress`. Mongo no publica
`27017` al host por defecto y persiste en `streaming_mongo_data`.

## Requisitos

- Docker Desktop
- Docker Compose v2 (`docker compose`)

## Levantar todo el ecosistema

Desde la raiz del repositorio, inicializa primero los submodulos git requeridos por `identity-service` y `catalog-service`:

```bash
git submodule update --init --recursive
docker compose up -d --build
```

## Ver estado

```bash
docker compose ps
docker compose logs -f identity-service
docker compose logs -f catalog-service
docker compose logs -f streaming-service
```

## Detener y limpiar

```bash
docker compose down
docker compose down -v
```

## Variables de entorno

Usa `.env.example` como plantilla oficial en la raiz.
El archivo de entorno unificado de ejecucion es `.env` en la raiz.
No uses `.env` locales dentro de servicios para el flujo normal con Docker Compose maestro.

## Seguridad: firma de eventos RabbitMQ

Para mejorar la integridad y autenticidad de los eventos publicados por el `identity-service`, el sistema ahora soporta firma HMAC de los mensajes. Configura la variable de entorno `EVENT_SIGNING_SECRET` (64 caracteres) en el archivo `.env` y pásala a los servicios mediante `docker-compose.yml`.

- El `identity-service` firma el payload JSON del evento y añade la cabecera `X-Event-Signature` con un HMAC-SHA256 en base64.
- El `catalog-service` valida la firma antes de procesar el mensaje; si la firma no coincide, el mensaje es rechazado (`nack`) y descartado para evitar procesamiento de eventos falsificados.

Nota: guarda `EVENT_SIGNING_SECRET` en un almacén seguro en producción y rota el secreto según tu política de seguridad.

## Puertos por defecto publicados en el host

- Gateway HTTP: `80`
- Identity PostgreSQL: `5433`
- Catalog PostgreSQL: `5434`
- RabbitMQ AMQP: `5672`
- RabbitMQ Management: `15672`

## Puertos internos de servicios

Estos puertos solo se exponen dentro de la red Docker; el trafico HTTP externo debe entrar por el gateway:

- Identity HTTP: `8081`
- Identity gRPC: `9091`
- Catalog HTTP: `8082`
- Media HTTP: `8083`
- Streaming HTTP: `8084`

## Playback bajo demanda

El flujo de reproduccion real entra por Gateway en `/api/v1/playback`.

- `POST /api/v1/playback/tracks/{trackId}/stream-session` valida JWT y devuelve un `streamUrl`.
- `GET /api/v1/playback/tracks/{trackId}/stream?playbackToken=...` sirve audio real desde MinIO con soporte de `Range`.
- `GET/PUT /api/v1/playback/progress/{trackId}` recupera y persiste progreso por usuario y pista.
- `GET /api/v1/catalog/albums/{albumId}/tracks` alimenta la cola real de albumes para `next`, `previous` y `shuffle`.

Health por gateway:

```bash
curl http://localhost/api/v1/playback/health
```
