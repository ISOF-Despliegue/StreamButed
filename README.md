# StreamButed

Monorepo de microservicios de StreamButed con orquestacion centralizada en la raiz.

## Servicios incluidos en el compose maestro

- `postgres` (PostgreSQL 16.2-alpine)
- `rabbitmq` (RabbitMQ 3.12-management-alpine)
- `identity-service`
- `catalog-service`

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

## Puertos por defecto

- Identity HTTP: `8081`
- Identity gRPC: `9091`
- Catalog HTTP: `8082`
- PostgreSQL: `5432`
- RabbitMQ AMQP: `5672`
- RabbitMQ Management: `15672`
