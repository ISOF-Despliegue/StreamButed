# Electron Desktop Auth Implementation

## Estado

Implementado en la rama `feat/electron-desktop-auth`.

No se hizo commit ni push. El repo principal esta en esa rama y `services/identity-service` tambien quedo en una rama local con el mismo nombre porque es un repo Git anidado.

## Objetivo Aplicado

Se implemento la opcion B:

- Electron carga el frontend empaquetado localmente usando `app://streambuted`.
- Electron consume solamente la API productiva/configurada, no puertos internos.
- Login normal, refresh y logout desktop pasan por el main process.
- Google OAuth desktop abre el navegador externo, completa OAuth en la web/backend actual y vuelve a Electron con `streambuted://auth/callback`.
- El deep link solo transporta `code` efimero y `state`; no transporta access token ni refresh token.
- El refresh token desktop queda en el main process, cifrado con `safeStorage`, y nunca se expone al renderer.

## Validacion Previa de Origin

Antes de tocar CORS se midio el `Origin` real desde Electron con el protocolo local registrado.

Resultado medido:

```text
Origin: app://streambuted
```

Con eso se justifico agregar `app://streambuted` a los origins permitidos para llamadas normales del renderer a la API. No se agrego `null`.

## Flujo Google OAuth Desktop

1. El renderer pide a preload iniciar Google OAuth desktop.
2. Preload llama al main process por IPC.
3. Main genera un `state` criptograficamente seguro y lo guarda en memoria con TTL.
4. Main abre el navegador externo en:

   ```text
   https://migueleelg0106.me/desktop-auth/start?state=...
   ```

5. La web guarda ese `state` en `sessionStorage`.
6. Si la web no tiene access token, manda al usuario al login normal/Google OAuth existente.
7. Google sigue regresando al backend actual:

   ```text
   https://api.migueleelg0106.me/api/v1/auth/oauth/google/callback
   ```

8. El backend mantiene el flujo web actual y redirige a la web.
9. La web recupera sesion como hoy, usando el refresh cookie web existente.
10. La ruta `/desktop-auth/start` llama al backend con Bearer access token para crear un handoff code.
11. La web redirige al deep link:

    ```text
    streambuted://auth/callback?code=...&state=...
    ```

12. Electron main recibe el deep link, valida esquema, host, path, `state`, TTL y replay.
13. Main intercambia el `code` contra `/auth/desktop/exchange`.
14. Backend invalida el code en primer uso y emite una sesion desktop.
15. Main guarda el refresh token con `safeStorage` y entrega solo la sesion sanitizada al renderer.

No hace falta registrar `streambuted://` en Google Cloud porque Google no redirige a Electron. Google sigue redirigiendo al backend actual.

## Cambios Backend

### Identity Service

Archivos nuevos:

- `src/main/java/streambuted/identity/config/DesktopAuthProperties.java`
- `src/main/java/streambuted/identity/controller/DesktopAuthController.java`
- `src/main/java/streambuted/identity/domain/DesktopAuthCodeEntity.java`
- `src/main/java/streambuted/identity/dto/DesktopExchangeRequest.java`
- `src/main/java/streambuted/identity/dto/DesktopHandoffCodeRequest.java`
- `src/main/java/streambuted/identity/dto/DesktopHandoffCodeResponse.java`
- `src/main/java/streambuted/identity/dto/DesktopLogoutRequest.java`
- `src/main/java/streambuted/identity/dto/DesktopRefreshRequest.java`
- `src/main/java/streambuted/identity/exception/DesktopAuthDisabledException.java`
- `src/main/java/streambuted/identity/exception/InvalidDesktopAuthCodeException.java`
- `src/main/java/streambuted/identity/exception/InvalidDesktopRedirectUriException.java`
- `src/main/java/streambuted/identity/repository/DesktopAuthCodeRepository.java`
- `src/main/java/streambuted/identity/scheduler/DesktopAuthCodeCleanup.java`
- `src/main/java/streambuted/identity/service/DesktopAuthService.java`
- `src/main/resources/db/manual/V3__desktop_auth_codes.sql`
- `src/test/java/streambuted/identity/controller/DesktopAuthControllerTest.java`

Archivos modificados:

- `src/main/java/streambuted/identity/security/AuthRateLimiter.java`
- `src/main/java/streambuted/identity/security/SecurityConfig.java`
- `src/main/java/streambuted/identity/service/AuthService.java`
- `src/main/java/streambuted/identity/service/AuthServiceImpl.java`
- `src/main/resources/application.yml`
- `src/test/java/streambuted/identity/security/AuthRateLimiterTest.java`

Endpoints nuevos:

```text
POST /api/v1/auth/desktop/login
POST /api/v1/auth/desktop/refresh
POST /api/v1/auth/desktop/logout
POST /api/v1/auth/desktop/handoff-codes
POST /api/v1/auth/desktop/exchange
```

Todos llaman primero a `desktopAuthService.ensureEnabled()`. Si `DESKTOP_AUTH_ENABLED=false`, quedan apagados sin afectar auth web.

### Sesion Desktop

Se cerraron los endpoints desktop explicitos:

- `desktop/login`: usa email/password normal y devuelve `accessToken` + `refreshToken` en JSON para que lo reciba Electron main.
- `desktop/refresh`: recibe refresh token en body desde main, rota token y devuelve nueva sesion.
- `desktop/logout`: recibe refresh token en body desde main y lo invalida.
- `desktop/handoff-codes`: requiere Bearer access token de una sesion web valida.
- `desktop/exchange`: intercambia handoff code + state por sesion desktop.

El renderer no llama directo a login/refresh/logout desktop; esas llamadas pasan por preload/main.

### Handoff Codes

Modelo agregado: `desktop_auth_code`.

Campos principales:

- `id`
- `account_id`
- `code_hash`
- `state_hash`
- `redirect_uri`
- `expires_at`
- `used_at`
- `created_at`

Propiedades de seguridad:

- El code real se genera con bytes aleatorios seguros.
- En base de datos se guarda `code_hash`, no el code plano.
- `state` tambien se guarda hasheado.
- El code queda ligado al usuario.
- TTL configurable, por defecto 300 segundos.
- El exchange bloquea la fila, valida expiracion y marca `used_at`.
- Un code reutilizado falla.
- Un code vencido falla.
- Un state incorrecto falla.
- Hay limpieza programada para codigos vencidos/usados antiguos.

### Rate Limit

Se agregaron limits especificos:

- Handoff: por IP + userId.
- Exchange: por IP.

Esto esta en `AuthRateLimiter` y se valida en tests.

### CORS

Cambios aplicados:

- CORS global acepta origins explicitos, nunca `*`.
- `app://streambuted` se acepta para endpoints normales porque se valido el Origin real.
- `/api/v1/auth/desktop/handoff-codes` permite solo origins web, no `app://streambuted`.
- `/api/v1/auth/desktop/login`, `/refresh`, `/logout`, `/exchange` quedan como endpoints para Electron main, sin CORS de navegador/renderer.

Razon:

- El renderer puede consumir APIs normales con Bearer access token.
- El renderer no debe poder manejar refresh token desktop.
- Handoff solo debe crearse desde la web autenticada.
- Main process no necesita CORS.

## Cambios Frontend Web

Archivos modificados:

- `front-streambuted/src/StreamButed.tsx`
- `front-streambuted/src/context/AuthContext.tsx`
- `front-streambuted/src/routes/appRoutes.ts`
- `front-streambuted/src/services/apiClient.ts`
- `front-streambuted/src/services/authService.ts`
- `front-streambuted/src/services/authService.test.ts`
- `front-streambuted/src/test/setupTests.ts`
- `front-streambuted/src/types/auth.types.ts`
- `front-streambuted/src/types/electron.d.ts`
- `front-streambuted/src/hooks/useLiveSocket.ts`
- `front-streambuted/.env.example`

Ruta nueva:

```text
/desktop-auth/start
```

Comportamiento:

- Lee `state` desde query string.
- Valida formato basico.
- Guarda pending desktop auth en `sessionStorage`.
- Si no hay access token, redirige al login.
- Si el usuario vuelve autenticado, retoma `/desktop-auth/start`.
- Crea handoff code usando Bearer access token.
- Redirige a `streambuted://auth/callback?code=...&state=...`.

Se mantuvo intacto el login web normal y Google OAuth web. La ruta desktop usa el flujo existente para obtener sesion web y solo agrega el handoff al final.

## Cambios Electron

Archivos modificados:

- `front-streambuted/electron/main.ts`
- `front-streambuted/electron/preload.ts`
- `front-streambuted/electron/tsconfig.json`

Main process:

- Registra `app://streambuted` como protocolo privilegiado, seguro y con soporte de fetch/CORS.
- Sirve el build local `dist` por `app://streambuted`.
- Aplica fallback a `index.html` para rutas SPA.
- Registra `streambuted://` como protocolo de deep link.
- Maneja deep links en:
  - instancia inicial;
  - segunda instancia en Windows;
  - evento `open-url` para plataformas que lo emitan.
- Abre navegador externo con `shell.openExternal`.
- Genera y conserva `state` en memoria, con TTL.
- Rechaza callbacks repetidos o maliciosos.
- Intercambia handoff code contra el backend desde main.
- Guarda refresh token cifrado con `safeStorage`.
- Falla cerrado si `safeStorage` no esta disponible.

Preload:

- Expone solo `window.streambuted.auth`.
- No expone `ipcRenderer` crudo.
- API disponible:
  - `login`
  - `refresh`
  - `logout`
  - `startGoogleOAuth`
  - `onOAuthResult`
  - `onOAuthError`

Seguridad BrowserWindow:

```ts
nodeIntegration: false
contextIsolation: true
sandbox: true
```

## Cambios Live / Socket.IO

Archivo modificado:

- `front-streambuted/src/hooks/useLiveSocket.ts`

Se agrego soporte para:

```text
VITE_SOCKET_URL
VITE_SOCKET_PATH
```

Produccion esperada:

```text
VITE_SOCKET_URL=https://api.migueleelg0106.me
VITE_SOCKET_PATH=/live/ws/socket.io/
```

## Cambios de Configuracion

Archivos modificados:

- `.env.example`
- `.env.production.example`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `services/identity-service/src/main/resources/application.yml`

Variables nuevas:

```env
DESKTOP_AUTH_ENABLED=true
DESKTOP_AUTH_CODE_TTL_SECONDS=300
DESKTOP_AUTH_ALLOWED_REDIRECT_URI=streambuted://auth/callback
DESKTOP_AUTH_WEB_ALLOWED_ORIGINS=https://migueleelg0106.me,https://www.migueleelg0106.me
ELECTRON_RENDERER_ORIGIN=app://streambuted
TRUST_FORWARDED_HEADERS=true
ELECTRON_ALLOWED_EXTERNAL_HOSTS=migueleelg0106.me,www.migueleelg0106.me,api.migueleelg0106.me,accounts.google.com,oauth2.googleapis.com
VITE_SOCKET_URL=https://api.migueleelg0106.me
VITE_SOCKET_PATH=/live/ws/socket.io/
VITE_DESKTOP_AUTH_START_URL=https://migueleelg0106.me/desktop-auth/start
```

## Produccion Recomendada

Variables relevantes para produccion:

```env
FRONTEND_URL=https://migueleelg0106.me
CORS_ALLOWED_ORIGINS=https://migueleelg0106.me,https://www.migueleelg0106.me,app://streambuted
DESKTOP_AUTH_WEB_ALLOWED_ORIGINS=https://migueleelg0106.me,https://www.migueleelg0106.me
TRUST_FORWARDED_HEADERS=true

VITE_API_BASE_URL=https://api.migueleelg0106.me/api
VITE_GATEWAY_URL=https://api.migueleelg0106.me
VITE_SOCKET_URL=https://api.migueleelg0106.me
VITE_SOCKET_PATH=/live/ws/socket.io/
VITE_DESKTOP_AUTH_START_URL=https://migueleelg0106.me/desktop-auth/start

REFRESH_COOKIE_SECURE=true
GOOGLE_CALLBACK_URL=https://api.migueleelg0106.me/api/v1/auth/oauth/google/callback
JWT_ISSUER=https://api.migueleelg0106.me
JWT_AUDIENCE=streambuted-api

DESKTOP_AUTH_ENABLED=true
DESKTOP_AUTH_CODE_TTL_SECONDS=300
DESKTOP_AUTH_ALLOWED_REDIRECT_URI=streambuted://auth/callback
ELECTRON_RENDERER_ORIGIN=app://streambuted
ELECTRON_ALLOWED_EXTERNAL_HOSTS=migueleelg0106.me,www.migueleelg0106.me,api.migueleelg0106.me,accounts.google.com,oauth2.googleapis.com
```

No agregar secretos a ejemplos ni a Git. Mantener fuera de repo:

- `GOOGLE_CLIENT_SECRET`
- JWT private key
- passwords
- `EVENT_SIGNING_SECRET`
- credenciales DB/Rabbit/MinIO

### Orden Seguro de Despliegue

1. Aplicar migracion de identity:

   ```text
   services/identity-service/src/main/resources/db/manual/V3__desktop_auth_codes.sql
   ```

2. Desplegar backend con `DESKTOP_AUTH_ENABLED=false`.
3. Verificar que siguen funcionando:
   - login web normal;
   - refresh web;
   - logout web;
   - Google OAuth web.
4. Desplegar frontend web con la ruta `/desktop-auth/start`.
5. Configurar `CORS_ALLOWED_ORIGINS` con `app://streambuted` ya validado.
6. Configurar `DESKTOP_AUTH_WEB_ALLOWED_ORIGINS` solo con origins web verificados. No incluir `app://streambuted`.
7. Configurar Nginx de borde para sobrescribir `X-Forwarded-For` y `X-Real-IP`; solo entonces usar `TRUST_FORWARDED_HEADERS=true` en identity.
8. Activar `DESKTOP_AUTH_ENABLED=true`.
9. Construir Electron con variables productivas:

   ```env
   VITE_API_BASE_URL=https://api.migueleelg0106.me/api
   VITE_GATEWAY_URL=https://api.migueleelg0106.me
   VITE_SOCKET_URL=https://api.migueleelg0106.me
   VITE_SOCKET_PATH=/live/ws/socket.io/
   VITE_DESKTOP_AUTH_START_URL=https://migueleelg0106.me/desktop-auth/start
   ```

10. Validar en una maquina limpia:
   - login normal desktop;
   - Google OAuth desktop;
   - refresh desktop despues de reiniciar app;
   - logout desktop;
   - media assets;
   - playback;
   - library/playlists;
   - live Socket.IO;
   - permisos camara/microfono.

### IP real y rate limit

`AuthRateLimiter` no confia en `X-Forwarded-For` por defecto. En produccion se puede usar:

```env
TRUST_FORWARDED_HEADERS=true
```

Solo activar esa variable si el Nginx publico esta instalado con la configuracion versionada en `gateway/nginx.api.prod.conf`, donde se sobrescriben headers entrantes:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

El gateway Docker en `gateway/nginx.conf` debe reenviar esos valores ya saneados sin usar `$proxy_add_x_forwarded_for`. Si se despliega otro proxy delante, debe aplicar la misma regla: limpiar/sobrescribir headers entrantes y no preservar valores enviados por clientes.

### Google Cloud

No registrar `streambuted://` como redirect URI de Google.

El unico redirect OAuth de Google debe seguir siendo:

```text
https://api.migueleelg0106.me/api/v1/auth/oauth/google/callback
```

El salto a Electron ocurre despues, desde la web, usando un handoff code propio.

### Empaquetado Electron

El codigo registra `streambuted://` con `app.setAsDefaultProtocolClient`.

Para un instalador real conviene revisar que el sistema de packaging tambien declare el protocolo custom:

- Windows: registro del protocolo en instalador/app empaquetada.
- macOS: `CFBundleURLTypes` en `Info.plist`.
- Linux: archivo `.desktop` con handler del scheme.

Actualmente el repo compila Electron, pero no se agrego una herramienta de packaging tipo `electron-builder` o similar. Eso queda como paso operativo si se necesita instalador firmable/distribuible.

## Rollback

Rollback de feature sin revertir codigo:

```env
DESKTOP_AUTH_ENABLED=false
```

Efecto:

- Apaga endpoints desktop.
- Mantiene login web actual.
- Mantiene Google OAuth web actual.
- Mantiene refresh cookie web actual.
- Mantiene logout web actual.

Rollback adicional si hubiera problemas CORS con Electron:

```env
CORS_ALLOWED_ORIGINS=https://migueleelg0106.me,https://www.migueleelg0106.me
```

Esto rompe llamadas del renderer Electron a la API, pero deja la web intacta.

## Pruebas Ejecutadas

Frontend:

```text
npm.cmd test -- --runInBand
```

Resultado:

```text
38 suites, 268 tests, OK
```

Build frontend/Electron:

```text
npm.cmd run build
```

Resultado:

```text
OK
```

Backend:

```text
JAVA_HOME=C:\Program Files\Java\jdk-21
.\mvnw.cmd test
```

Resultado:

```text
117 tests, OK
```

Nota: para backend se necesita JDK 21. Con otro JDK Maven puede fallar con `release version 21 not supported`.

## Cosas a Revisar Antes de Produccion

- Mantener logs de Spring MVC en `INFO` o superior. En `DEBUG`, Spring puede imprimir cuerpos de respuesta en tests, y eso podria incluir tokens.
- Confirmar que el gateway/Nginx no loguea query strings completos para `streambuted://` no aplica en servidor, pero si conviene no loguear handoff codes en la web.
- Confirmar que la web productiva sirve `/desktop-auth/start` con fallback SPA.
- Confirmar que no se genera `/api/api/v1`: se valido el caso `VITE_API_BASE_URL=https://api.migueleelg0106.me/api`, pero debe mantenerse ese contrato.
- Confirmar que el instalador de Electron registra `streambuted://` en cada sistema objetivo.
- Confirmar que `safeStorage.isEncryptionAvailable()` es verdadero en los entornos objetivo. Si no, el login desktop fallara cerrado.
- Confirmar que `DESKTOP_AUTH_CODE_TTL_SECONDS=300` es aceptable; se puede bajar a 60-120 segundos si se quiere menor ventana.
- Confirmar que los rate limits son adecuados para trafico real y proxies. `TRUST_FORWARDED_HEADERS=true` requiere que Nginx sobrescriba `X-Real-IP` y `X-Forwarded-For`.
- Confirmar que la migracion `desktop_auth_code` se aplica en la base correcta de identity-service.
- Confirmar que `REFRESH_COOKIE_SECURE=true` se mantiene en produccion. No hace falta debilitar SameSite para desktop porque desktop no depende de la cookie web.
- Confirmar que el frontend web puede recuperar access token despues de Google OAuth usando el refresh web actual antes de llamar handoff.
- Confirmar que UDP 10000-10100 sigue abierto para WebRTC/live; esta implementacion no toca esa parte.

## Archivos Principales Para Revision

Backend:

- `services/identity-service/src/main/java/streambuted/identity/controller/DesktopAuthController.java`
- `services/identity-service/src/main/java/streambuted/identity/service/DesktopAuthService.java`
- `services/identity-service/src/main/java/streambuted/identity/security/SecurityConfig.java`
- `services/identity-service/src/main/java/streambuted/identity/security/AuthRateLimiter.java`
- `services/identity-service/src/main/resources/db/manual/V3__desktop_auth_codes.sql`

Frontend/Electron:

- `front-streambuted/electron/main.ts`
- `front-streambuted/electron/preload.ts`
- `front-streambuted/src/StreamButed.tsx`
- `front-streambuted/src/services/authService.ts`
- `front-streambuted/src/services/apiClient.ts`
- `front-streambuted/src/context/AuthContext.tsx`

Config:

- `.env.example`
- `.env.production.example`
- `docker-compose.yml`
- `docker-compose.prod.yml`
