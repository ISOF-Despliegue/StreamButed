# Analytics Service

## 1. Rol dentro de la plataforma

`analytics-service` es el servicio de proyeccion y consulta analitica de StreamButed. No participa en el camino critico de autenticacion ni en la entrega binaria del audio, pero si convierte eventos del dominio en vistas agregadas utiles para dashboards, ranking publico y metricas administrativas.

Su papel es doble:

- consumir eventos desde RabbitMQ para construir proyecciones en MongoDB;
- exponer endpoints HTTP de lectura para frontend, artistas y administradores.

En tiempo de ejecucion el servicio combina:

- `FastAPI` para la API REST;
- `Motor` para acceso async a MongoDB;
- `Pika` para consumo AMQP desde RabbitMQ;
- `PyJWT + JWKS` para validar access tokens RS256 emitidos por `identity-service`;
- llamadas HTTP hacia `identity-service` para verificar estado real de cuenta, incluyendo cuentas suspendidas.

## 2. Flujo tecnico principal

### 2.1 Ingesta de eventos

El proceso arranca en `services/analytics-service/app/main.py`. `create_app()` crea:

- repositorio Mongo;
- `JwtValidator`;
- `AnalyticsService`;
- `AnalyticsEventConsumer`.

Durante el `lifespan`:

- crea indices en Mongo;
- levanta un consumidor RabbitMQ en un hilo dedicado;
- deja el loop async principal solo para HTTP y tareas de aplicacion.

El consumidor escucha tres flujos:

- `streaming.events` con routing key `track.playback.counted`;
- `identity.events` con routing key `user.logged-in`;
- `catalog.events` con wildcard `#`.

Cada mensaje:

1. llega como `body: bytes` desde AMQP;
2. se decodifica a UTF-8;
3. se valida contra la cabecera `X-Event-Signature`;
4. se parsea como JSON;
5. se reinyecta al loop async con `asyncio.run_coroutine_threadsafe(...)`;
6. se confirma con `basic_ack` o se rechaza con `basic_nack`.

### 2.2 Consulta analitica

La lectura se hace por HTTP en `/api/v1/analytics`.

Los principales casos son:

- resumen publico de descubrimiento;
- resumen publico y privado de artista;
- resumen administrativo global.

La autorizacion depende del rol JWT:

- `ADMIN` puede ver metricas globales;
- `ARTIST` solo puede consultar su propio dashboard;
- endpoints publicos no requieren token.

## 3. Persistencia y modelo de datos

Aunque no se expone aqui un esquema formal, el patron del repositorio muestra que MongoDB almacena varias colecciones o documentos proyectados para:

- reproducciones contadas por usuario y pista;
- snapshots de artista;
- snapshots de album;
- snapshots de track;
- actividad de usuario para usuarios activos.

La razon de usar Mongo aqui es clara:

- el servicio trabaja con documentos agregados y vistas de lectura;
- no necesita joins transaccionales como `catalog-service` o `identity-service`;
- es adecuado para snapshots y contadores proyectados desde eventos.

## 4. Seguridad y confianza del mensaje

### 4.1 JWT

El servicio valida tokens RS256 con JWKS publicado por `identity-service`.

El flujo es:

1. extraer `Authorization: Bearer ...`;
2. leer `kid` del header JWT;
3. descargar o usar cache de JWKS;
4. construir la public key;
5. verificar firma, `iss`, `aud`, `exp`, `sub`;
6. llamar a `/api/v1/auth/validate` en `identity-service` para confirmar que la cuenta sigue activa y no esta suspendida.

Eso significa que el JWT por si mismo no basta: tambien se hace validacion de estado vivo de la cuenta.

### 4.2 Firma HMAC de eventos

RabbitMQ por si solo enruta mensajes; no autentica semanticamente el payload a nivel de aplicacion. Para evitar procesar eventos falsificados, el servicio:

- calcula o valida HMAC-SHA256;
- usa Base64 para transportar la firma;
- compara en tiempo constante con `hmac.compare_digest`.

Esto protege integridad del cuerpo JSON publicado entre microservicios.

## 5. Protocolos usados

### HTTP/1.1

Se usa para:

- endpoints REST de consulta;
- descarga del documento JWKS;
- validacion del estado del token contra `identity-service`.

### AMQP 0-9-1 sobre RabbitMQ

Se usa para:

- bind de colas a exchanges tipo `topic`;
- consumo con QoS (`prefetch_count=10`);
- `ack`, `nack`, `requeue`.

Semantica efectiva:

- si el mensaje es invalido o la firma no coincide, se descarta;
- si hay error transitorio, puede reencolarse.

### JSON canonico firmado

Los eventos se tratan como documentos JSON. La firma se calcula sobre la version serializada del payload, no sobre una estructura Python en memoria, porque lo que se quiere proteger es el contenido exacto transportado.

## 6. Que hace cada archivo

### Nucleo de arranque

- `app/config.py`: carga variables de entorno, valida `CORS_ALLOWED_ORIGINS`, resuelve puertos, Mongo, RabbitMQ y JWT.
- `app/main.py`: ensamblador principal; crea dependencias, registra middleware CORS, handlers de excepcion, router y consumidor de eventos.
- `app/server.py`: levanta Uvicorn y expone el servicio HTTP.
- `app/errors.py`: contrato comun de errores; normaliza respuestas JSON, timestamps UTC y mensajes de validacion en español.

### API de analitica

- `app/analytics/routes.py`: define rutas REST, dependencias FastAPI, autorizacion por rol y endpoints publicos/privados.
- `app/analytics/service.py`: capa de aplicacion; convierte eventos en operaciones de repositorio y arma respuestas agregadas.
- `app/analytics/repository.py`: acceso real a MongoDB; encapsula indices, upserts, agregaciones y queries de ranking.
- `app/analytics/schemas.py`: modelos Pydantic de entrada/salida y modelos de eventos consumidos.

### Seguridad

- `app/auth/jwt_validator.py`: validacion RS256 con JWKS cacheado y chequeo activo del estado de cuenta en `identity-service`.
- `app/auth/models.py`: `AuthenticatedUser`, `UserRole` y normalizacion de claims `ROLE_*`.

### Integracion por eventos

- `app/events/consumer.py`: consumidor RabbitMQ en hilo dedicado, declaracion de topologia, callbacks y estrategia `ack/nack`.
- `app/events/signer.py`: HMAC-SHA256 Base64 y comparacion segura.

### Pruebas

- `tests/test_analytics_service.py`: cubre comportamiento del servicio, rutas y validaciones de negocio.
- `tests/test_infrastructure.py`: cubre integracion base de componentes de infraestructura.

### Empaquetado

- `requirements.txt`: stack Python y dependencias runtime/test.
- `Dockerfile`: imagen del servicio para Compose.
- `README.md`: guia local resumida.

## 7. Flujos de negocio concretos

### 7.1 Conteo de reproduccion

1. `front-streambuted` guarda progreso en `streaming-service`.
2. `streaming-service` detecta que la reproduccion supero el umbral valido.
3. publica `TrackPlaybackCounted`.
4. `analytics-service` consume ese evento.
5. persiste reproduccion idempotente por `eventId`.
6. recalcula rankings y vistas por artista/album/track.

### 7.2 Login de usuario

1. `identity-service` registra login y publica `user.logged-in`.
2. `analytics-service` registra actividad.
3. sus queries administrativas pueden calcular usuarios activos en una ventana temporal.

### 7.3 Snapshot de catalogo

1. `catalog-service` publica cambios de artista, album o track.
2. `analytics-service` actualiza snapshots locales.
3. los rankings se pueden servir sin depender de joins vivos contra Catalog.

## 8. Riesgos y decisiones tecnicas

- La validacion del token depende de dos llamadas remotas: JWKS y `/validate`; si `identity-service` cae, la API autenticada se degrada.
- La proyeccion es eventualmente consistente: una reproduccion puede tardar unos segundos en reflejarse.
- El uso de un hilo RabbitMQ separado evita bloquear el loop async, pero obliga a coordinar con `run_coroutine_threadsafe`.
- El descarte de mensajes mal firmados es una decision deliberada de seguridad.

## 9. Resumen operativo

`analytics-service` es un lector materializado de eventos del dominio. Su valor no esta en escribir datos originales, sino en traducir trafico de negocio a vistas de lectura estables, consultables y seguras.
