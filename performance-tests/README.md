# StreamButed Performance Tests

Suite de pruebas k6 para smoke, carga, estres, picos, soak, catalogo, flujo mixto anonimo y ejemplo autenticado opcional.

Estas pruebas estan pensadas para ejecutarse desde una laptop o desde una maquina externa usando Docker. No requieren instalar k6 localmente y no modifican infraestructura productiva.

## Estructura

```text
performance-tests/
  README.md
  scripts/
    health-smoke.js
    health-load.js
    health-stress.js
    health-spike.js
    health-soak.js
    catalog-load.js
    mixed-api-flow.js
    authenticated-flow.example.js
  reports/
    .gitkeep
```

## Variables

| Variable | Default | Uso |
| --- | --- | --- |
| `API_BASE_URL` | `https://api.migueleelg0106.me` | Base URL del gateway/API. |
| `FRONTEND_URL` | `https://migueleelg0106.me` | URL del frontend para el flujo mixto. |
| `CATALOG_SEARCH_TERMS` | `a,music,rock,pop` | Terminos separados por coma para busquedas de catalogo. |
| `ACCESS_TOKEN` | vacio | Token Bearer para el ejemplo autenticado. |
| `AUTH_EMAIL` | vacio | Email para login opcional en el ejemplo autenticado. |
| `AUTH_PASSWORD` | vacio | Password para login opcional en el ejemplo autenticado. |

No guardes tokens, usuarios reales sensibles ni passwords en el repo. Usa variables de entorno.

## Ejecucion Rapida

Linux/macOS:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-smoke.js
```

Windows PowerShell:

```powershell
$env:API_BASE_URL="https://api.migueleelg0106.me"
docker run --rm -i -e API_BASE_URL=$env:API_BASE_URL grafana/k6 run - < performance-tests/scripts/health-smoke.js
```

Script secuencial en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1
```

## Comandos Por Prueba

Smoke:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-smoke.js
```

Load:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-load.js
```

Stress:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-stress.js
```

Spike:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-spike.js
```

Soak:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me grafana/k6 run - < performance-tests/scripts/health-soak.js
```

Catalogo, solo lectura:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me -e CATALOG_SEARCH_TERMS="a,music,rock,pop" grafana/k6 run - < performance-tests/scripts/catalog-load.js
```

Flujo mixto anonimo:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me -e FRONTEND_URL=https://migueleelg0106.me grafana/k6 run - < performance-tests/scripts/mixed-api-flow.js
```

Ejemplo autenticado con token existente:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me -e ACCESS_TOKEN="$ACCESS_TOKEN" grafana/k6 run - < performance-tests/scripts/authenticated-flow.example.js
```

Ejemplo autenticado con login opcional:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me -e AUTH_EMAIL="$AUTH_EMAIL" -e AUTH_PASSWORD="$AUTH_PASSWORD" grafana/k6 run - < performance-tests/scripts/authenticated-flow.example.js
```

PowerShell con token:

```powershell
$env:API_BASE_URL="https://api.migueleelg0106.me"
$env:ACCESS_TOKEN="pegar-token-temporal"
docker run --rm -i -e API_BASE_URL=$env:API_BASE_URL -e ACCESS_TOKEN=$env:ACCESS_TOKEN grafana/k6 run - < performance-tests/scripts/authenticated-flow.example.js
```

## Reportes JSON

Linux/macOS:

```bash
docker run --rm -i -e API_BASE_URL=https://api.migueleelg0106.me -v "$PWD/performance-tests/reports:/reports" grafana/k6 run --summary-export=/reports/summary-health-load.json - < performance-tests/scripts/health-load.js
```

Windows PowerShell:

```powershell
docker run --rm -i -e API_BASE_URL="https://api.migueleelg0106.me" -v "${PWD}\performance-tests\reports:/reports" grafana/k6 run --summary-export=/reports/summary-health-load.json - < performance-tests/scripts/health-load.js
```

## Ejecucion Secuencial

`run-all.ps1` ejecuta por defecto esta secuencia:

1. `smoke`
2. `load`
3. `catalog-load`
4. `mixed-api-flow`

`stress`, `spike`, `soak` y el ejemplo autenticado son opt-in. El script:

- guarda un JSON por prueba en `performance-tests/reports`
- se detiene si alguna prueba falla
- imprime el plan antes de empezar

Ejecucion base:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1
```

Con `stress` y `spike`:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1 -IncludeStress -IncludeSpike
```

Con `soak`:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1 -IncludeSoak
```

Con prueba autenticada usando token:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1 -IncludeAuthenticated -AccessToken "tu_token"
```

Con prueba autenticada usando login:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1 -IncludeAuthenticated -AuthEmail "tu_correo" -AuthPassword "tu_password"
```

Con parametros personalizados:

```powershell
powershell -ExecutionPolicy Bypass -File .\performance-tests\run-all.ps1 -ApiBaseUrl "https://api.migueleelg0106.me" -FrontendUrl "https://migueleelg0106.me" -CatalogSearchTerms "a,rock,pop,jazz"
```

## Endpoints Cubiertos

Health publicos:

```text
/api/v1/auth/actuator/health
/api/v1/catalog/health
/api/v1/media/health
/api/v1/playback/health
/api/v1/analytics/health
/api/v1/live/health
```

Catalogo publico de lectura detectado en el repo:

```text
GET /api/v1/catalog/search?searchTerm={term}&limit={limit}&offset={offset}
GET /api/v1/catalog/artists/{artistId}
GET /api/v1/catalog/artists/{artistId}/albums
GET /api/v1/catalog/artists/{artistId}/tracks
GET /api/v1/catalog/albums/{albumId}
GET /api/v1/catalog/albums/{albumId}/tracks
GET /api/v1/catalog/tracks/{trackId}
```

`catalog-load.js` usa solo `/api/v1/catalog/search` porque no hay IDs productivos seguros en el repo. El archivo deja `TODO` para agregar endpoints de detalle cuando existan IDs de lectura confirmados.

Identidad autenticada detectada en el repo:

```text
POST /api/v1/auth/login
GET /api/v1/users/me
GET /api/v1/auth/validate
```

El payload de login es:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

## Interpretacion De Resultados

Metricas principales:

| Metrica | Significado |
| --- | --- |
| `http_reqs` | Total de peticiones realizadas. |
| `http_req_duration` | Latencia total de cada request. |
| `p(95)` | 95% de requests respondieron igual o mas rapido que ese valor. |
| `p(99)` | 99% de requests respondieron igual o mas rapido que ese valor. |
| `http_req_failed` | Tasa de requests fallidos segun k6. |
| `checks` | Validaciones exitosas definidas en los scripts. |
| RPS | Requests por segundo, visible en el resumen como tasa de `http_reqs`. |

Criterios iniciales sugeridos:

| Prueba | Error aceptable | p95 inicial |
| --- | --- | --- |
| Smoke | 0% ideal, umbral `< 1%` | health `< 800 ms` |
| Load moderado | `< 1%` | health `< 800 ms`, catalogo `< 1500 ms` |
| Stress | `< 5%` | health `< 1500 ms` |
| Spike | `< 5%` | health `< 2000 ms` |
| Soak | `< 2%` | health `< 1200 ms` |

Deten la prueba si aparecen 5xx sostenidos, CPU/RAM saturadas, reinicios de contenedores, timeouts repetidos o degradacion visible para usuarios reales.

## Checklist De Monitoreo En Servidor

Conectarse al servidor productivo y entrar al proyecto:

```bash
cd /opt/streambuted
```

Ver estado de servicios:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Ver consumo en vivo:

```bash
docker stats
```

Logs por servicio:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 gateway
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 identity-service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 catalog-service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 streaming-service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 analytics-service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 live-service
```

Recursos del host:

```bash
htop
```

Si `htop` no esta instalado:

```bash
apt update
apt install -y htop
```

Checklist durante cada prueba:

- Confirmar que `docker compose ps` no muestra reinicios.
- Revisar CPU, RAM, red y disco con `docker stats`.
- Revisar logs de `gateway` y del servicio bajo prueba.
- Anotar fecha, hora, script, VUs maximos y resultado.
- Detener si hay errores 5xx sostenidos o recursos saturados.
- Guardar resumen JSON en `performance-tests/reports`.

## Seguridad Y Limites

- No ejecutar stress fuerte en horario de uso real.
- No probar subida masiva de archivos en produccion sin autorizacion.
- No probar reproduccion masiva de audio/video sin limites.
- No incluir tokens reales en commits.
- Usar variables de entorno para credenciales.
- No ejecutar ataques, fuzzing ni pruebas destructivas; esto es load testing controlado.
- No usar `docker compose down -v`.
- No borrar datos.

## Plan Recomendado

1. Ejecutar `health-smoke.js`.
2. Revisar `docker compose ps`.
3. Ejecutar `health-load.js`.
4. Revisar `docker stats`.
5. Ejecutar `catalog-load.js`.
6. Ejecutar `health-stress.js` si load paso estable.
7. Revisar logs de `gateway` y servicios.
8. Ejecutar `health-spike.js`.
9. Ejecutar `health-soak.js` solo si los anteriores pasaron.
10. Guardar reportes en `performance-tests/reports` y documentar resultados.
