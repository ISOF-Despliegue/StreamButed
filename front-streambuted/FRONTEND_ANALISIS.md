# Analisis del Frontend - StreamButed

> Actualizacion 2026-05-06: el frontend ya no esta en estado mock para las
> pantallas productivas principales. La primera unificacion con Identity,
> Catalog y Media por Gateway quedo implementada. Para el detalle actualizado
> ver `../docs/FRONTEND_UNIFICACION_BACKEND.md`,
> `../docs/FRONTEND_SERVICIOS.md` y `../docs/FRONTEND_MOCKS.md`.

Documento complementario:

- `docs/FRONTEND_ARQUITECTURA_ACTUAL.md`

Ese documento es la referencia principal para entender la distribucion actual entre web, Electron, main, preload, renderer y shared.

## 1. Resumen general

El frontend de StreamButed ya quedo alineado en su base tecnologica con el planteamiento del proyecto:

- React
- TypeScript progresivo
- Vite
- Electron
- CSS
- Recharts
- Jest + React Testing Library

La aplicacion conserva las vistas principales de oyente, artista y administrador. El backend real todavia no esta integrado; por ahora se mantienen datos mock y autenticacion simulada.

## 2. Estado tecnologico actual

| Tecnologia | Estado |
| --- | --- |
| React | Implementado |
| Vite | Implementado |
| TypeScript | Configurado como migracion progresiva |
| Electron | Implementado como contenedor desktop |
| CSS | Implementado con estilos globales |
| Recharts | Implementado para dashboards |
| ESLint | Configurado para JS, JSX, TS y TSX |
| Jest | Implementado |
| React Testing Library | Implementado |
| Backend real | Pendiente |
| Datos mock | En uso temporal |
| Router | Pendiente |
| Player real con audio | Pendiente |

## 3. Dependencias principales

```json
{
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "recharts": "^3.8.1"
}
```

## 4. Dependencias de desarrollo relevantes

```json
{
  "typescript": "^6.0.3",
  "electron": "^42.0.0",
  "concurrently": "^9.2.1",
  "wait-on": "^9.0.5",
  "jest": "^30.3.0",
  "jest-environment-jsdom": "^30.3.0",
  "babel-jest": "^30.3.0",
  "@testing-library/react": "^16.3.2",
  "@testing-library/jest-dom": "^6.9.1",
  "@testing-library/user-event": "^14.6.1",
  "typescript-eslint": "^8.59.2"
}
```

## 5. Scripts disponibles

Desde `front-streambuted`:

| Script | Funcion |
| --- | --- |
| `npm run dev` | Levanta Vite en desarrollo |
| `npm run typecheck` | Ejecuta TypeScript sin emitir archivos |
| `npm run build:renderer` | Genera build web con Vite |
| `npm run build:electron` | Compila el proceso Electron |
| `npm run build` | Ejecuta typecheck, build web y build Electron |
| `npm run lint` | Ejecuta ESLint |
| `npm run test` | Ejecuta Jest |
| `npm run preview` | Sirve el build web |
| `npm run electron` | Ejecuta Electron con el build disponible |
| `npm run electron:dev` | Ejecuta Vite y Electron en modo desarrollo |

## 6. Estructura actual relevante

```txt
front-streambuted/
  .env.example
  babel.config.cjs
  eslint.config.js
  index.html
  jest.config.cjs
  package.json
  tsconfig.json
  vite.config.ts
  electron/
    main.ts
    package.json
    preload.ts
    tsconfig.json
  scripts/
    run-electron.cjs
  src/
    main.tsx
    App.tsx
    StreamButed.tsx
    index.css
    App.css
    vite-env.d.ts
    components/
    data/
      mockData.js
    pages/
    test/
      setupTests.ts
      fileMock.cjs
    types/
      electron.d.ts
```

## 7. TypeScript

TypeScript ya esta configurado con:

- `tsconfig.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/StreamButed.tsx`
- ESLint para archivos TS/TSX

La migracion es progresiva. Todavia existen componentes y paginas en JS/JSX, pero el proyecto ya puede compilar y verificar TypeScript.

Comando verificado:

```bash
npm run typecheck
```

Estado: correcto.

## 8. Electron

Electron ya esta implementado con una capa minima y segura:

```txt
electron/
  main.ts
  package.json
  preload.ts
  tsconfig.json
scripts/
  run-electron.cjs
```

Configuracion aplicada:

- `contextIsolation: true`
- `nodeIntegration: false`
- `preload` dedicado
- API minima expuesta en `window.streambuted`
- React no accede directamente a APIs de Node
- Links externos se abren con `shell.openExternal`
- `scripts/run-electron.cjs` limpia `ELECTRON_RUN_AS_NODE` antes de abrir Electron

El proceso principal carga:

- `http://localhost:5173` en modo desarrollo
- `dist/index.html` en modo build

Comando verificado:

```bash
npm run build:electron
```

Estado: correcto.

## 9. Testing

Jest + React Testing Library ya estan configurados.

Archivos agregados:

```txt
jest.config.cjs
babel.config.cjs
src/test/setupTests.ts
src/test/fileMock.cjs
src/pages/AuthPages.test.tsx
```

Pruebas iniciales:

- Render del formulario de login
- Cambio desde login hacia registro mediante callback

Comando verificado:

```bash
npm test -- --runInBand
```

Estado: correcto.

## 10. Punto de entrada

El punto de entrada del renderer ahora es:

```txt
src/main.tsx
```

`index.html` carga:

```html
<script type="module" src="/src/main.tsx"></script>
```

`src/App.tsx` renderiza el componente principal:

```tsx
import StreamButed from "./StreamButed";

export default function App() {
  return <StreamButed />;
}
```

## 11. Arquitectura funcional actual

La navegacion todavia se maneja con estado local dentro de `StreamButed.tsx`.

Estados principales:

```txt
authPage
user
page
viewAlbum
viewArtist
editTrack
currentTrack
isPlaying
progress
volume
shuffle
repeat
expandedPlayer
toastMsg
```

Pendiente recomendado:

- Integrar `react-router-dom`
- Crear rutas protegidas
- Separar layouts por rol
- Extraer Auth/Player/Toast a contextos

## 12. Roles disponibles

### Oyente

- Home
- Search
- Library
- Lives
- Settings
- Album detail
- Artist profile

### Artista

- Funciones de oyente
- Dashboard de artista
- Mis pistas
- Subir pista
- Crear album
- Editar pista
- Analiticas

### Administrador

- Overview
- Usuarios
- Contenido
- Reportes
- Moderacion
- Settings

## 13. Estado de mocks

Los mocks siguen activos y son temporales.

Archivo principal:

```txt
src/data/mockData.js
```

Contiene:

- Artistas
- Tracks
- Albumes
- Usuarios mock
- Moderacion mock
- Actividad reciente
- Datos de graficas

No hay integracion real con backend todavia.

## 14. Autenticacion actual

La autenticacion sigue simulada en `AuthPages.jsx`.

Credenciales mock de admin:

```txt
Email: admin@streambuted.com
Password: admin123
```

Cualquier otro login entra como `listener`.

## 15. Reproductor

El reproductor sigue siendo visual y simulado:

- No usa `<audio>`
- No consume streaming real
- El progreso se simula con `setInterval`
- La duracion viene desde mocks

Pendiente:

- Integrar audio real
- Integrar endpoint de streaming
- Persistir progreso
- Manejar errores de carga

## 16. Variables de entorno

Se agrego `.env.example` para preparar integracion futura:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## 17. Verificacion ejecutada

Comandos ejecutados correctamente:

```bash
npm install
npm run typecheck
npm run build:electron
npm run lint
npm run build
npm test -- --runInBand
```

Resultado:

```txt
TypeScript: correcto
Electron build: correcto
ESLint: correcto
Build completo: correcto
Jest: correcto
```

Advertencia observada:

```txt
Some chunks are larger than 500 kB after minification.
```

Esto no rompe el build. Es una recomendacion futura para code splitting.

## 18. Brechas restantes

| Brecha | Estado |
| --- | --- |
| Backend real | Pendiente |
| Router | Pendiente |
| Servicios frontend | Pendiente |
| Contextos globales | Pendiente |
| Player real | Pendiente |
| Packaging desktop final | Pendiente |
| Migracion completa de JSX a TSX | Pendiente |
| Tests ampliados | Pendiente |

## 19. Conclusion

La base tecnologica del frontend ya quedo implementada y alineada con la documentacion principal: React, TypeScript, Vite, Electron, CSS, Recharts y Jest + React Testing Library.

El proyecto sigue siendo un prototipo funcional en cuanto a datos e integracion, porque backend, streaming real, rutas y servicios frontend aun quedan pendientes. La diferencia importante es que ahora la base tecnica ya esta lista para continuar la organizacion e integracion progresiva.
