# Reporte de pruebas de integracion StreamButed

Fecha de ejecucion local: 2026-05-14

## Entorno

- Stack local levantado con Docker Compose.
- Gateway disponible en `http://localhost`.
- Suite ejecutada con Newman usando el environment `tests/postman/StreamButed.local.postman_environment.json`.

## Suite vigente creada

Archivo:

- `tests/postman/StreamButed-Current-Auth-Smoke.postman_collection.json`

Flujos cubiertos:

- Health de `identity-service`, `catalog-service` y playback.
- Inicio de registro por correo con estado `pending`.
- Rechazo de login antes de verificar el codigo de correo.
- Reenvio de codigo, validando que el intento anterior quede reemplazado.
- Rechazo de verificacion con intento reemplazado.
- Cancelacion del intento activo.
- Rechazo de verificacion con intento cancelado.
- Redirect inicial de Google OAuth con scopes `email` y `profile`.
- Busqueda publica de catalogo.
- Rechazo de creacion de album sin JWT.

Comando ejecutado:

```powershell
npx --yes newman run tests/postman/StreamButed-Current-Auth-Smoke.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json
```

Resultado:

- Requests ejecutados: 12
- Assertions ejecutadas: 25
- Assertions fallidas: 0
- Estado: PASS

## Suite full-flow existente

Archivo:

- `tests/postman/StreamButed-Identity-Catalog.postman_collection.json`

Comando ejecutado:

```powershell
npx --yes newman run tests/postman/StreamButed-Identity-Catalog.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json
```

Resultado:

- Requests ejecutados: 27
- Assertions ejecutadas: 44
- Assertions fallidas: 33
- Estado: FAIL

Motivo principal:

- La suite esperaba que `POST /api/v1/auth/register` respondiera `201` con `accessToken`.
- El flujo actual responde `202 Accepted` y deja el registro en estado `pending` hasta verificar el codigo enviado por correo.
- Como no obtiene token, las pruebas posteriores de `users/me`, promocion a artista y CRUD protegido de catalogo fallan por `401` o `403`.

## Nota de cobertura

La suite Postman valida integracion en vivo, pero no genera cobertura de codigo fuente para SonarQube. La cobertura que SonarQube consumira en GitHub Actions queda generada por:

- `front-streambuted/coverage/lcov.info`
- `services/catalog-service/coverage/lcov.info`
- `services/identity-service/target/site/jacoco/jacoco.xml`
- `services/media-service/coverage.xml`
- `services/streaming-service/coverage.xml`

Pruebas de cobertura ejecutadas localmente:

- Frontend: 11 suites, 33 tests, PASS.
- Catalog service: 10 suites, 26 tests, PASS.
- Identity service: 81 tests, PASS.
- Media service: 20 tests, PASS.
- Streaming service: 21 tests, PASS con 3 warnings de Pydantic sobre alias en campos.

Para recuperar una suite full-flow que complete registro verificado, promocion, creacion de album y canciones, hace falta una estrategia deterministica para el codigo de verificacion en entorno de pruebas, por ejemplo un SMTP de pruebas accesible por Newman o un endpoint/test profile que no exista en produccion.
