# Documentacion viva OpenAPI / Swagger

StreamButed expone documentacion viva desde los propios microservicios y una vista agregada en el gateway.

## Entrada principal

Con el compose maestro levantado:

```bash
docker compose up -d --build
```

Abre:

```txt
http://localhost/api/docs/
```

La pagina carga Swagger UI con selector de microservicio y consume los specs publicados por el gateway.

## URLs por microservicio

| Servicio | Swagger UI | OpenAPI JSON |
| --- | --- | --- |
| Identity | `/api/v1/identity/docs` | `/api/v1/identity/openapi.json` |
| Catalog | `/api/v1/catalog/docs` | `/api/v1/catalog/openapi.json` |
| Media | `/api/v1/media/docs` | `/api/v1/media/openapi.json` |
| Streaming | `/api/v1/streaming/docs` | `/api/v1/streaming/openapi.json` |
| Analytics | `/api/v1/analytics/docs` | `/api/v1/analytics/openapi.json` |
| Live | `/api/v1/live/docs` | `/api/v1/live/openapi.json` |

## Fuentes de verdad

- `identity-service`: Springdoc genera el spec desde controladores y DTOs de Spring Boot.
- `media-service`, `streaming-service`, `analytics-service`: FastAPI genera el spec desde routers y modelos Pydantic.
- `catalog-service`: el spec vive en `src/interfaces/http/openapi/CatalogOpenApi.ts`, junto a la capa HTTP.
- `live-service`: el spec vive en `src/openapi.js`, cerca del servidor Express/Socket.IO.
- `gateway`: sirve la vista agregada desde `docs/swagger` y enruta los specs publicados por cada servicio.

## Autenticacion en Swagger

Los specs declaran `BearerAuth`. Para probar endpoints protegidos:

1. Inicia sesion en `POST /api/v1/auth/login`.
2. Copia el `accessToken`.
3. En Swagger UI pulsa `Authorize`.
4. Pega el token como Bearer token.

## Produccion

El host Nginx de produccion ya reenvia `/api/` al gateway Docker, por lo que la vista agregada queda bajo:

```txt
https://api.migueleelg0106.me/api/docs/
```
