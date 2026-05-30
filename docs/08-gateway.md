# Gateway

## 1. Funcion

El `gateway` es la puerta HTTP unica del ecosistema. Usa `nginx` para:

- exponer una sola entrada externa;
- enrutar por prefijo a cada microservicio;
- proteger cabeceras;
- cortar acceso directo a rutas internas;
- soportar uploads, playback largo y Socket.IO.

## 2. Topologia de upstreams

En `gateway/nginx.conf` aparecen seis upstreams internos:

- `identity_service -> identity-service:8081`
- `catalog_service -> catalog-service:8082`
- `media_service -> media-service:8083`
- `streaming_service -> streaming-service:8084`
- `analytics_service -> analytics-service:8085`
- `live_service -> live-service:3003`

Eso desacopla nombres de servicio internos de la URL publica.

## 3. Rutas principales

- `/api/v1/auth/` -> Identity
- `/api/v1/users/` -> Identity
- `/api/v1/catalog/` -> Catalog
- `/api/v1/media/` -> Media
- `/api/v1/playback/` -> Streaming
- `/api/v1/library/` -> Streaming
- `/api/v1/analytics/` -> Analytics
- `/api/v1/live/` -> Live REST
- `/live/ws/socket.io/` -> Live Socket.IO

## 4. Seguridad de gateway

Cabeceras aplicadas:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Strict-Transport-Security`

Tambien hay decisiones de minimizacion:

- bloquea `/api/v1/media/assets/{id}/metadata` a nivel publico;
- rutas internas tipo `/socket.io/` cruda se devuelven 404 en config productiva host-level;
- paths de admin/actuator/minio/rabbitmq/grpc se ocultan a nivel host.

## 5. Casos especiales de proxy

### Uploads

Para Media se desactiva `proxy_request_buffering`, lo que evita copiar completamente el body antes de enviarlo al upstream y ayuda en archivos grandes.

### Playback

Para Streaming:

- reenvia `Range` e `If-Range`;
- desactiva buffering;
- aumenta timeouts a 3600s.

Esto es critico para audio largo y seeks.

### Live Socket.IO

La ruta publica `/live/ws/socket.io/` se reescribe a `/socket.io/` del servicio real, con:

- `Upgrade`;
- `Connection upgrade`;
- timeouts largos;
- buffering desactivado.

## 6. Configuracion de produccion fuera de Compose

Hay dos archivos host-level:

- `nginx.api.bootstrap.conf`: solo para certbot antes de tener certificados.
- `nginx.api.prod.conf`: termina TLS en el host y reenvia al gateway Docker en `127.0.0.1:8080`.

Esto implica una doble capa:

1. Nginx host termina HTTPS;
2. Nginx dentro de Docker enruta a microservicios.

## 7. Por que esta separado del documento transversal

Aunque el gateway es transversal, merece documento propio porque:

- define el contrato de entrada publica real;
- condiciona playback y live;
- es parte critica de seguridad perimetral.
