# Identity Service

## 1. Papel del servicio

`identity-service` es el ancla de confianza de StreamButed. Centraliza:

- registro;
- login;
- refresh token;
- logout;
- emision de JWT;
- publicacion de JWKS;
- perfil del usuario;
- promocion de rol a artista;
- suspension de cuentas;
- verificacion por correo;
- Google OAuth;
- validacion gRPC de token para consumo interno.

Es el servicio mas sensible en seguridad. Su stack es:

- `Spring Boot 3.5`;
- `Java 21`;
- `Spring Security`;
- `Spring Data JPA`;
- `PostgreSQL`;
- `Spring AMQP`;
- `Spring Mail`;
- `gRPC Java`;
- `jjwt` para RS256.

## 2. Configuracion operativa

La configuracion en `application.yml` deja ver todos los subsistemas:

- servidor HTTP `8081`;
- servidor gRPC `9091`;
- datasource PostgreSQL;
- RabbitMQ;
- SMTP;
- JWT issuer/audience/keys;
- propiedades de Google OAuth;
- bootstrap opcional de admin;
- actuator.

Una observacion importante: el servicio firma JWT con clave privada RSA, y el resto del ecosistema valida con la clave publica expuesta via JWKS.

## 3. Modelo de seguridad

### 3.1 Access token

`JwtService` emite JWT RS256 con claims:

- `sub`: UUID del usuario;
- `email`;
- `role`;
- `iss`;
- `aud`;
- `exp`;
- `iat`;
- `jti`.

Esto lo vuelve adecuado para validacion descentralizada en otros servicios sin compartir la private key.

### 3.2 Refresh token

Los refresh tokens no se guardan en claro. `RefreshTokenEntity` almacena:

- token opaco hasheado;
- expiracion;
- estado revocado;
- auditoria.

Eso reduce impacto si la base se expone.

### 3.3 JWKS

El documento JWKS permite que `catalog-service`, `streaming-service`, `media-service`, `analytics-service` y `live-service` descarguen claves publicas activas por `kid`.

### 3.4 Validacion por filtro

`JwtAuthenticationFilter`:

1. busca `Authorization`;
2. extrae Bearer token;
3. valida claims con `JwtService`;
4. crea `UsernamePasswordAuthenticationToken`;
5. rellena `SecurityContext`.

Todo request autenticado en REST depende de este filtro.

## 4. Flujo de autenticacion

### Registro

1. el usuario manda email, username y password;
2. `RegistrationVerificationService` crea registro temporal con `code_hash`;
3. se manda correo con codigo;
4. al verificar, se crea `UserAccountEntity` y `UserProfileEntity`;
5. se responde con sesion autenticada.

### Login

1. se busca la cuenta;
2. se valida password BCrypt;
3. se comprueba estado activo/no baneado;
4. se emite access token;
5. se rota o crea refresh token;
6. se publica evento `user.logged-in` via outbox.

### Refresh

1. el cliente manda cookie o contexto de refresh;
2. se valida token almacenado y no revocado;
3. se rota el refresh token;
4. se emite nuevo access token.

### Logout

Se revoca el refresh token activo, cortando renovaciones futuras aunque el access token aun no expire.

## 5. Perfil, rol y moderacion

El servicio no solo autentica, tambien gobierna identidad operativa:

- perfil publico;
- username;
- bio;
- `profileImageAssetId`;
- promocion a artista;
- baneo temporal o permanente;
- reactivacion.

Cuando un listener se convierte en artista:

1. cambia el rol en Identity;
2. se genera evento `USER_PROMOTED`;
3. `catalog-service` lo consume y crea el artista editorial correspondiente.

## 6. Google OAuth

`GoogleOAuthService` encapsula:

- intercambio de codigo por credenciales;
- lectura del perfil de Google;
- mapeo a cuenta local.

Esto permite:

- registro/login federado;
- cuentas con `googleSubject`;
- flujo adicional de `setup password` para casos donde la plataforma quiera credencial local despues del alta social.

## 7. Integracion con Media Service

`GrpcMediaAssetClient` valida `profileImageAssetId` contra `media-service`.

No confia en un UUID arbitrario del cliente. Comprueba por gRPC:

- que exista el asset;
- que el owner corresponda;
- que la metadata sea coherente.

Esto evita referencias colgantes o secuestro de recursos ajenos.

## 8. RabbitMQ y outbox

La publicacion de eventos se hace con:

- `IdentityEventPublisher`;
- `RabbitMqConfig`;
- `OutboxProcessor`;
- `OutboxEntity`.

Eventos visibles desde configuracion:

- `user-promoted`;
- `user-logged-in`.

El patron es el mismo que en otros servicios maduros del repo:

1. persistir negocio + outbox;
2. scheduler lee pendientes;
3. intenta publicar;
4. marca `PROCESSED` o aumenta `retryCount`.

## 9. Protocolo gRPC interno

`token_validator.proto` define `TokenValidator.ValidateToken`.

Uso:

- microservicios internos pueden validar un token y obtener identidad resumida;
- evita reimplementar logica compleja en ciertos consumidores;
- aunque varios servicios del repo optan por JWKS + REST validate, el contrato gRPC existe como mecanismo interno adicional.

## 10. Que hace cada archivo principal

### Arranque y configuracion

- `IdentityServiceApplication.java`: entrypoint Spring y habilitacion de scheduler.
- `application.yml`: wiring de BD, mail, RabbitMQ, JWT, OAuth, gRPC y health.

### Seguridad

- `SecurityConfig.java`: reglas de acceso, CORS estricto, politica stateless y encoder BCrypt.
- `JwtService.java`: emision y parseo de JWT RS256.
- `JwtAuthenticationFilter.java`: extrae Bearer y puebla `SecurityContext`.
- `RsaJwtKeyProvider.java`: resuelve/genera claves RSA, `kid` y material JWKS.
- `JwtProperties.java`: binding de propiedades JWT.
- `AuthRateLimiter.java`: proteccion contra abuso de endpoints de auth.

### Controladores

- `AuthController.java`: registro, login, refresh, logout, OAuth, JWKS, validate.
- `UserController.java`: perfil, promocion a artista, endpoints administrativos de usuarios.

### Servicios de negocio

- `AuthService.java` / `AuthServiceImpl.java`: login, refresh, logout, oauth y emision de tokens.
- `UserService.java` / `UserServiceImpl.java`: perfil, rol, baneo, consultas administrativas.
- `RegistrationVerificationService.java`: flujo de verificacion previa al alta definitiva.
- `VerificationEmailService.java`: envio SMTP del codigo.
- `VerificationCodeGenerator.java`: generacion de codigo verificable.
- `AdminAccountBootstrap.java`: crea cuenta admin inicial si esta habilitado.

### OAuth

- `service/oauth/GoogleOAuthService.java`: coordinacion del flujo social.
- `GoogleOAuthClient.java`: contrato de cliente OAuth.
- `GoogleOAuthHttpClient.java`: implementacion HTTP.
- `GoogleOAuthMode.java`, `GoogleUserInfo.java`: soporte de modo y DTO.

### gRPC

- `grpc/TokenValidatorGrpcService.java`: valida token y responde identidad resumida.
- `src/main/proto/token_validator.proto`: contrato protobuf.

### Media

- `media/MediaAssetClient.java`: contrato de validacion de asset.
- `media/GrpcMediaAssetClient.java`: adaptador gRPC real.
- `media/MediaAssetMetadata.java`: DTO de respuesta.

### Mensajeria

- `messaging/RabbitMqConfig.java`: exchanges, templates y configuracion AMQP.
- `messaging/IdentityEventPublisher.java`: publica eventos firmados.
- `messaging/UserPromotedEvent.java`, `UserLoggedInEvent.java`: DTOs de eventos.
- `scheduler/OutboxProcessor.java`: relay programado del outbox.

### Dominio y persistencia

- `domain/UserAccountEntity.java`: cuenta, rol, estado activo, suspension y password hash.
- `domain/UserProfileEntity.java`: perfil publico 1:1.
- `domain/RefreshTokenEntity.java`: refresh tokens revocables.
- `domain/RegistrationVerificationEntity.java`: verificacion de alta.
- `domain/OutboxEntity.java`: outbox transaccional.
- `domain/Role.java`, `OutboxStatus.java`, `RegistrationVerificationStatus.java`: enums del dominio.

### Repositorios

- `repository/UserAccountRepository.java`
- `repository/UserProfileRepository.java`
- `repository/RefreshTokenRepository.java`
- `repository/RegistrationVerificationRepository.java`
- `repository/OutboxRepository.java`

Todos encapsulan acceso JPA al modelo persistente.

### DTOs y errores

- `dto/*.java`: contratos REST para requests/responses de auth, moderacion y perfil.
- `exception/*.java`: taxonomia de errores controlados, incluido baneo, credenciales invalidas, rate limit y problemas de verificacion.

### SQL manual

- `src/main/resources/db/manual/V1__initial_schema.sql`
- `src/main/resources/db/manual/V2__extend_username_length.sql`

Expresan el esquema base y ajustes de evolucion.

## 11. Flujos interservicio

### 11.1 Validacion descentralizada

1. Identity emite JWT RS256.
2. otro servicio descarga JWKS.
3. valida firma localmente.
4. opcionalmente consulta `/api/v1/auth/validate` para estado de cuenta.

### 11.2 Promocion a artista

1. usuario se promueve;
2. Identity cambia rol;
3. persiste outbox;
4. publica `user.promoted`;
5. Catalog hace upsert de `Artist`.

### 11.3 Login auditado

1. login correcto;
2. outbox registra `user.logged-in`;
3. Analytics consume y proyecta actividad.

## 12. Decisiones de seguridad importantes

- RS256 evita compartir secreto simetrico entre microservicios.
- BCrypt costo 12 endurece password hashing.
- refresh tokens hasheados mitigan fuga de base.
- CORS exige origenes explicitos, sin `*`.
- la cuenta puede invalidarse aun con JWT valido criptograficamente, gracias al endpoint de validacion viva.
