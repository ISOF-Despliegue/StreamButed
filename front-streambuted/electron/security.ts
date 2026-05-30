export const APP_ORIGIN = "app://streambuted";
export const DEEP_LINK_PROTOCOL = "streambuted";
export const DESKTOP_CALLBACK_URL = "streambuted://auth/callback";

const DEFAULT_EXTERNAL_HOSTS = [
  "migueleelg0106.me",
  "www.migueleelg0106.me",
  "api.migueleelg0106.me",
  "accounts.google.com",
  "oauth2.googleapis.com",
];

const MEDIA_PERMISSIONS = new Set(["media", "audioCapture", "videoCapture"]);

export type DeepLinkValidationResult =
  | { valid: true; code: string; state: string }
  | { valid: false };

export function getAllowedExternalHosts(): Set<string> {
  const configuredHosts = (process.env.ELECTRON_ALLOWED_EXTERNAL_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_EXTERNAL_HOSTS, ...configuredHosts]);
}

export function isAllowedExternalUrl(
  rawUrl: string,
  allowedHosts = getAllowedExternalHosts(),
  allowLocalhostHttp = false
): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    if (
      allowLocalhostHttp &&
      parsedUrl.protocol === "http:" &&
      (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return parsedUrl.protocol === "https:" && allowedHosts.has(parsedUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isAllowedRendererNavigation(rawUrl: string, appOrigin = APP_ORIGIN, devServerUrl?: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    if (isAppProtocolUrl(parsedUrl, appOrigin)) {
      return true;
    }

    return Boolean(devServerUrl && parsedUrl.origin === new URL(devServerUrl).origin);
  } catch {
    return false;
  }
}

export function isAllowedPermissionRequest(rawOrigin: string, permission: string, appOrigin = APP_ORIGIN): boolean {
  return isAppOriginValue(rawOrigin, appOrigin) && MEDIA_PERMISSIONS.has(permission);
}

function isAppOriginValue(rawValue: string, appOrigin: string): boolean {
  if (rawValue === appOrigin) {
    return true;
  }

  try {
    return isAppProtocolUrl(new URL(rawValue), appOrigin);
  } catch {
    return false;
  }
}

function isAppProtocolUrl(parsedUrl: URL, appOrigin: string): boolean {
  const appUrl = new URL(appOrigin);
  return parsedUrl.protocol === appUrl.protocol && parsedUrl.hostname === appUrl.hostname;
}

export function validateDeepLinkCallback(rawUrl: string): DeepLinkValidationResult {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { valid: false };
  }

  const code = parsedUrl.searchParams.get("code")?.trim() ?? "";
  const state = parsedUrl.searchParams.get("state")?.trim() ?? "";
  const isExpectedCallback =
    parsedUrl.protocol === `${DEEP_LINK_PROTOCOL}:` &&
    parsedUrl.hostname === "auth" &&
    parsedUrl.pathname === "/callback";

  if (!isExpectedCallback || !code || !state) {
    return { valid: false };
  }

  return { valid: true, code, state };
}

export function buildRendererContentSecurityPolicy(apiBaseUrl: string): string {
  const apiOrigin = new URL(`${apiBaseUrl.replace(/\/+$/, "")}/`).origin;
  const wsOrigin = apiOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
    `img-src 'self' data: blob: ${apiOrigin}`,
    `media-src 'self' blob: ${apiOrigin}`,
    "font-src 'self' data:",
    "form-action 'self'",
  ].join("; ");
}
