# Guía de ramas y flujo de subida

Este repositorio usa una estrategia de trabajo basada en ramas y Pull Requests para proteger la rama principal `main`.

## 1. Rama principal

La rama principal del proyecto es:

```text
main
```

Reglas de `main`:

- No se debe trabajar directamente sobre `main`.
- No se deben subir cambios directamente a `main`.
- Todo cambio debe entrar mediante Pull Request.
- La rama `main` debe mantenerse estable.
- No se permite hacer `force push` sobre `main`.
- No se permite eliminar la rama `main`.

## 2. Responsables de autorización

Los cambios deben ser revisados y autorizados por una persona distinta al autor del Pull Request.

Responsables autorizados:

```text
Miguel
Uriel
```

Regla de revisión:

- Si Miguel crea el Pull Request, Uriel debe revisarlo y aprobarlo.
- Si Uriel crea el Pull Request, Miguel debe revisarlo y aprobarlo.
- Ningún autor debe aprobar sus propios cambios.
- Si hay observaciones en el Pull Request, deben resolverse antes del merge.

## 3. Convención para nombrar ramas

Las ramas deben seguir este formato:

```text
tipo/area-o-servicio/descripcion-corta
```

Ejemplos:

```text
feature/frontend/login-page
feature/backend/auth-service
feature/database/users-table
bugfix/frontend/form-validation
docs/branching-guide
chore/github-settings
refactor/backend-user-service
```

## 4. Tipos de ramas permitidas

| Tipo | Uso |
|---|---|
| `feature/` | Nueva funcionalidad |
| `bugfix/` | Corrección de errores |
| `hotfix/` | Corrección urgente |
| `docs/` | Documentación |
| `refactor/` | Mejora interna sin cambiar funcionalidad |
| `chore/` | Configuración o mantenimiento |
| `style/` | Cambios visuales o de formato |

## 5. Áreas o servicios recomendados

Cuando aplique, la rama debe indicar el área afectada:

| Área | Uso |
|---|---|
| `frontend` | Interfaces, vistas o componentes |
| `backend` | Servicios, lógica del servidor o controladores |
| `database` | Tablas, migraciones o consultas |
| `api` | Endpoints o contratos de API |
| `docs` | Documentación |
| `config` | Archivos de configuración |
| `deploy` | Archivos de despliegue |

Ejemplos:

```text
feature/frontend/register-page
feature/backend/user-service
feature/database/products-table
feature/api/login-endpoint
docs/project-setup
chore/config-gitignore
```

## 6. Reglas para nombrar ramas

Las ramas deben cumplir lo siguiente:

- Usar letras minúsculas.
- Usar guiones medios `-` para separar palabras.
- No usar espacios.
- No usar acentos.
- No usar `ñ`.
- No usar nombres personales.
- No usar nombres genéricos como `cambios`, `prueba`, `final` o `avance`.

Ejemplos correctos:

```text
feature/frontend/login-form
bugfix/backend/user-validation
docs/readme-installation
chore/update-gitignore
```

Ejemplos incorrectos:

```text
login
cambios
prueba
avance
final
mi-rama
cosas
```

## 7. Flujo para subir cambios

### Paso 1: Actualizar `main`

Antes de iniciar un cambio:

```bash
git checkout main
git pull origin main
```

### Paso 2: Crear una rama nueva

Ejemplo:

```bash
git checkout -b feature/frontend/login-page
```

### Paso 3: Realizar los cambios

Después de modificar archivos, revisar el estado:

```bash
git status
```

### Paso 4: Preparar los archivos

Agregar todos los cambios:

```bash
git add .
```

O agregar archivos específicos:

```bash
git add ruta/del/archivo
```

### Paso 5: Crear commit

El mensaje del commit debe ser claro:

```bash
git commit -m "feat: agrega pantalla de login"
```

Tipos de commit recomendados:

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de error |
| `docs` | Documentación |
| `refactor` | Mejora interna |
| `chore` | Configuración o mantenimiento |
| `style` | Cambios visuales o de formato |

Ejemplos:

```bash
git commit -m "feat: agrega registro de usuarios"
git commit -m "fix: corrige validacion de correo"
git commit -m "docs: agrega guia de ramas"
```

### Paso 6: Subir la rama

```bash
git push -u origin feature/frontend/login-page
```

### Paso 7: Crear Pull Request

En GitHub:

```text
Pull requests → New pull request
```

Configurar:

```text
base: main
compare: nombre-de-la-rama
```

Ejemplo:

```text
base: main
compare: feature/frontend/login-page
```

### Paso 8: Revisión y autorización

El Pull Request debe ser revisado por el otro responsable:

- Miguel revisa los cambios de Uriel.
- Uriel revisa los cambios de Miguel.

Antes de aprobar, se debe verificar:

- Que la rama tenga un nombre correcto.
- Que los cambios correspondan al objetivo del Pull Request.
- Que no haya archivos innecesarios.
- Que no se incluyan credenciales, tokens o archivos `.env`.
- Que no existan conflictos con `main`.
- Que los comentarios del Pull Request estén resueltos.

### Paso 9: Hacer merge

Cuando el Pull Request esté aprobado, usar:

```text
Squash and merge
```

Después del merge, se puede eliminar la rama de trabajo.

## 8. Restricciones

No está permitido:

```bash
git push origin main
git push --force origin main
git push origin --delete main
```

También se prohíbe:

- Trabajar directamente sobre `main`.
- Aprobar cambios propios.
- Subir archivos sensibles como `.env`, contraseñas, tokens o llaves privadas.
- Usar nombres de ramas genéricos.
- Hacer merge sin revisión.
- Resolver comentarios del Pull Request sin atenderlos realmente.

## 9. Si se trabajó por error en `main`

Si los cambios aún no se han subido, crear una rama desde el estado actual:

```bash
git checkout -b feature/area/descripcion
```

Luego subir la rama:

```bash
git push -u origin feature/area/descripcion
```

Después abrir Pull Request hacia `main`.

## 10. Resumen del flujo

```text
Actualizar main
↓
Crear rama de trabajo
↓
Realizar cambios
↓
Crear commit
↓
Subir rama
↓
Abrir Pull Request
↓
Revisión por Miguel o Uriel
↓
Aprobación
↓
Squash and merge hacia main
↓
Eliminar rama de trabajo
```
