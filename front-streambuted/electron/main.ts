import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  protocol,
  safeStorage,
  shell,
} from "electron";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  APP_ORIGIN,
  DEEP_LINK_PROTOCOL,
  DESKTOP_CALLBACK_URL,
  buildRendererContentSecurityPolicy,
  isAllowedExternalUrl,
  isAllowedPermissionRequest,
  isAllowedRendererNavigation,
  validateDeepLinkCallback,
} from "./security.js";

const isDev = process.argv.includes("--dev");
const devServerUrl = "http://localhost:5173";
const appProtocol = "app";
const appOrigin = APP_ORIGIN;
const deepLinkProtocol = DEEP_LINK_PROTOCOL;
const desktopCallbackUrl = DESKTOP_CALLBACK_URL;
const defaultApiBaseUrl = "https://api.migueleelg0106.me/api";
const defaultDesktopAuthStartUrl = "https://migueleelg0106.me/desktop-auth/start";

type AuthResponse = {
  accessToken: string;
  refreshToken?: string | null;
  role: string;
  expiresIn: number;
};

type PendingDesktopOAuth = {
  state: string;
  expiresAt: number;
  handled: boolean;
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: appProtocol,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let pendingDesktopOAuth: PendingDesktopOAuth | null = null;

function getApiBaseUrl(): string {
  return (process.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, "");
}

function getDesktopAuthStartUrl(): string {
  return process.env.VITE_DESKTOP_AUTH_START_URL || defaultDesktopAuthStartUrl;
}

function buildApiUrl(apiPath: string): string {
  const apiBase = new URL(`${getApiBaseUrl()}/`);
  const basePath = apiBase.pathname === "/" ? "" : apiBase.pathname.replace(/\/$/, "");
  const apiPrefix = basePath === "/api" ? "/v1" : "/api/v1";
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return new URL(`${basePath}${apiPrefix}${normalizedPath}`, apiBase.origin).toString();
}

function getRendererDistPath(): string {
  return path.resolve(__dirname, "../dist");
}

function getSessionFilePath(): string {
  return path.join(app.getPath("userData"), "desktop-session.bin");
}

async function readFileResponse(filePath: string): Promise<Response> {
  const content = await fs.readFile(filePath);
  const headers: Record<string, string> = { "content-type": resolveContentType(filePath) };
  if (path.extname(filePath).toLowerCase() === ".html") {
    headers["content-security-policy"] = buildRendererContentSecurityPolicy(getApiBaseUrl());
  }
  return new Response(content, { headers });
}

async function registerAppProtocol(): Promise<void> {
  protocol.handle(appProtocol, async (request) => {
    const rendererDistPath = getRendererDistPath();
    const requestUrl = new URL(request.url);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const requestedPath = path.resolve(rendererDistPath, relativePath);

    if (!isPathInside(rendererDistPath, requestedPath)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const stat = await fs.stat(requestedPath);
      if (stat.isFile()) {
        return readFileResponse(requestedPath);
      }
    } catch {
      // BrowserRouter routes should fall back to index.html.
    }

    return readFileResponse(path.join(rendererDistPath, "index.html"));
  });
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function resolveContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "StreamButed",
    backgroundColor: "#0A0A0D",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url, undefined, isDev)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedRendererNavigation(url, appOrigin, isDev ? devServerUrl : undefined)) {
      return;
    }

    event.preventDefault();
    if (isAllowedExternalUrl(url, undefined, isDev)) {
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    try {
      callback(isAllowedPermissionRequest(webContents.getURL(), permission, appOrigin));
    } catch {
      callback(false);
    }
  });

  if (isDev) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadURL(`${appOrigin}/index.html`);
}

async function postJson<T>(apiPath: string, body: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(apiPath), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await resolveApiErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function resolveApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message || payload.error || "No se pudo completar la autenticacion desktop.";
  } catch {
    return "No se pudo completar la autenticacion desktop.";
  }
}

async function storeRefreshToken(refreshToken: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("El almacenamiento seguro del sistema no esta disponible.");
  }

  const encrypted = safeStorage.encryptString(refreshToken).toString("base64");
  await fs.mkdir(path.dirname(getSessionFilePath()), { recursive: true });
  await fs.writeFile(getSessionFilePath(), encrypted, { encoding: "utf8" });
}

async function readRefreshToken(): Promise<string | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      await clearRefreshToken();
      return null;
    }

    const encrypted = await fs.readFile(getSessionFilePath(), { encoding: "utf8" });
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    await clearRefreshToken();
    return null;
  }
}

async function clearRefreshToken(): Promise<void> {
  await fs.rm(getSessionFilePath(), { force: true });
}

async function commitDesktopSession(response: AuthResponse): Promise<AuthResponse> {
  if (!response.refreshToken) {
    throw new Error("La respuesta desktop no incluyo refresh token.");
  }

  await storeRefreshToken(response.refreshToken);
  return sanitizeAuthResponse(response);
}

function sanitizeAuthResponse(response: AuthResponse): AuthResponse {
  return {
    accessToken: response.accessToken,
    role: response.role,
    expiresIn: response.expiresIn,
  };
}

async function refreshDesktopSession(): Promise<AuthResponse> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    throw new Error("No hay sesion desktop activa.");
  }

  const response = await postJson<AuthResponse>("/auth/desktop/refresh", { refreshToken });
  return commitDesktopSession(response);
}

async function logoutDesktopSession(): Promise<void> {
  const refreshToken = await readRefreshToken();
  try {
    if (refreshToken) {
      await postJson<void>("/auth/desktop/logout", { refreshToken });
    }
  } finally {
    await clearRefreshToken();
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("auth:login", async (_event, request: { email: string; password: string }) => {
    const response = await postJson<AuthResponse>("/auth/desktop/login", request);
    return commitDesktopSession(response);
  });

  ipcMain.handle("auth:refresh", async () => refreshDesktopSession());
  ipcMain.handle("auth:logout", async () => logoutDesktopSession());

  ipcMain.handle("auth:start-google-oauth", async () => {
    const state = crypto.randomBytes(32).toString("base64url");
    pendingDesktopOAuth = {
      state,
      expiresAt: Date.now() + 5 * 60 * 1000,
      handled: false,
    };

    const startUrl = new URL(getDesktopAuthStartUrl());
    startUrl.searchParams.set("state", state);
    startUrl.searchParams.set("provider", "google");
    startUrl.searchParams.set("mode", "login");
    if (!isAllowedExternalUrl(startUrl.toString(), undefined, isDev)) {
      pendingDesktopOAuth = null;
      throw new Error("La URL de autenticacion desktop no esta permitida.");
    }
    await shell.openExternal(startUrl.toString());
  });
}

async function handleDeepLink(url: string): Promise<void> {
  const callback = validateDeepLinkCallback(url);
  if (!callback.valid) {
    sendOAuthError("El callback desktop no es valido.");
    return;
  }

  if (
    !pendingDesktopOAuth ||
    pendingDesktopOAuth.handled ||
    pendingDesktopOAuth.expiresAt < Date.now() ||
    pendingDesktopOAuth.state !== callback.state
  ) {
    sendOAuthError("La solicitud de autenticacion desktop expiro o no coincide.");
    return;
  }

  pendingDesktopOAuth.handled = true;

  try {
    const response = await postJson<AuthResponse>("/auth/desktop/exchange", {
      code: callback.code,
      state: callback.state,
    });
    const sanitized = await commitDesktopSession(response);
    mainWindow?.webContents.send("auth:oauth-result", sanitized);
  } catch (error) {
    await clearRefreshToken();
    sendOAuthError(error instanceof Error ? error.message : "No se pudo completar Google OAuth desktop.");
  } finally {
    pendingDesktopOAuth = null;
  }
}

function sendOAuthError(message: string): void {
  mainWindow?.webContents.send("auth:oauth-error", message);
}

function registerDeepLinkHandling(): void {
  app.setAsDefaultProtocolClient(deepLinkProtocol);

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((argument) => argument.startsWith(`${deepLinkProtocol}://`));
    if (deepLink) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      void handleDeepLink(deepLink);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleDeepLink(url);
  });
}

registerDeepLinkHandling();
registerIpcHandlers();

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await registerAppProtocol();
  createMainWindow();

  const startupDeepLink = process.argv.find((argument) => argument.startsWith(`${deepLinkProtocol}://`));
  if (startupDeepLink) {
    void handleDeepLink(startupDeepLink);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
