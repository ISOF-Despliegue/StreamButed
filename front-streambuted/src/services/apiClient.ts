import { authTokenStore } from "./authTokenStore";
import type { ApiErrorPayload, ApiRequestOptions } from "../types/api.types";
import { browserLogger } from "../utils/browserLogger";
import { toUserFacingMessage } from "../utils/userFacingMessages";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.migueleelg0106.me/api";
export const SESSION_TERMINATED_EVENT = "streambuted:session-terminated";

const DEFAULT_API_PREFIX = "/api/v1";
const API_BASE = new URL(`${API_BASE_URL}/`);
const API_BASE_PATH = API_BASE.pathname === "/" ? "" : API_BASE.pathname.replace(/\/$/, "");
const API_PREFIX = API_BASE_PATH === "/api" ? "/v1" : DEFAULT_API_PREFIX;
let refreshAccessTokenPromise: Promise<string | null> | null = null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !(value instanceof FormData);
}

function hasUnsafePathSegment(pathname: string): boolean {
  return pathname
    .split("/")
    .some((segment) => {
      const lowerSegment = segment.toLowerCase();
      return (
        segment === "." ||
        segment === ".." ||
        lowerSegment === "%2e" ||
        lowerSegment === "%2e%2e" ||
        lowerSegment.includes("%2f") ||
        lowerSegment.includes("%5c")
      );
    });
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const charCode = character.charCodeAt(0);
    return charCode <= 31 || charCode === 127;
  });
}

function normalizeApiPath(path: string): string {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    throw new Error("API path is required.");
  }

  if (/^[a-z][a-z\d+\-.]*:/i.test(trimmedPath) || trimmedPath.startsWith("//")) {
    throw new Error("API path must be relative to the configured gateway.");
  }

  if (trimmedPath.includes("\\") || hasControlCharacter(trimmedPath)) {
    throw new Error("API path contains unsupported characters.");
  }

  const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  const withoutPrefix = [DEFAULT_API_PREFIX, API_PREFIX]
    .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) === index)
    .reduce(
      (pathWithoutPrefix, prefix) => pathWithoutPrefix.startsWith(prefix)
        ? pathWithoutPrefix.slice(prefix.length)
        : pathWithoutPrefix,
      normalizedPath
    );
  const pathname = withoutPrefix.split(/[?#]/)[0];

  if (!withoutPrefix.startsWith("/") || hasUnsafePathSegment(pathname)) {
    throw new Error("API path contains unsafe path traversal segments.");
  }

  return withoutPrefix;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function buildApiUrl(path: string): string {
  const safePath = normalizeApiPath(path);
  const url = new URL(`${API_BASE_PATH}${API_PREFIX}${safePath}`, API_BASE.origin);

  if (url.origin !== API_BASE.origin) {
    throw new Error("API URL must target the configured gateway origin.");
  }

  return url.toString();
}

function serializeBody(body: unknown): BodyInit | null | undefined {
  return isPlainObject(body) ? JSON.stringify(body) : (body as BodyInit | null | undefined);
}

function extractBannedPayload(body: unknown): ApiErrorPayload | null {
  if (!isPlainObject(body)) {
    return null;
  }

  const payload = body as ApiErrorPayload;
  if (payload.code === "ACCOUNT_BANNED" || payload.error === "AccountBannedException") {
    return payload;
  }

  if (!isPlainObject(payload.details)) {
    return null;
  }

  const nestedPayload = payload.details as ApiErrorPayload;
  if (nestedPayload.code !== "ACCOUNT_BANNED" && nestedPayload.error !== "AccountBannedException") {
    return null;
  }

  return {
    ...nestedPayload,
    message: payload.message ?? nestedPayload.message,
  };
}

function terminateSession(payload: ApiErrorPayload): void {
  authTokenStore.clear();
  window.dispatchEvent(
    new CustomEvent<ApiErrorPayload>(SESSION_TERMINATED_EVENT, {
      detail: payload,
    })
  );
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshAccessTokenPromise) {
    return refreshAccessTokenPromise;
  }

  refreshAccessTokenPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: new Headers({ "Content-Type": "application/json" }),
      });

      if (!response.ok) {
        authTokenStore.clear();
        return null;
      }

      const payload = await response.json() as { accessToken?: string | null };
      const refreshedToken = payload.accessToken ?? null;

      if (!refreshedToken) {
        authTokenStore.clear();
        return null;
      }

      authTokenStore.setAccessToken(refreshedToken);
      return refreshedToken;
    } catch (error) {
      browserLogger.warn("Session refresh request failed.", error);
      authTokenStore.clear();
      return null;
    } finally {
      refreshAccessTokenPromise = null;
    }
  })();

  return refreshAccessTokenPromise;
}

async function sendApiRequest(
  path: string,
  options: ApiRequestOptions,
  token: string | null
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (isPlainObject(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...options,
    credentials: "include",
    headers,
    body: serializeBody(options.body),
  });
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      browserLogger.warn("Failed to parse JSON error body from API response.", error);
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : null;
  } catch (error) {
    browserLogger.warn("Failed to read text error body from API response.", error);
    return null;
  }
}

function resolveErrorMessage(status: number, body: unknown): string {
  const payload = body as ApiErrorPayload | null;

  if (payload?.message) return toUserFacingMessage(payload.message);
  if (payload?.error) return toUserFacingMessage(payload.error);
  if (status === 401) return "La sesión expiró. Inicia sesión nuevamente.";
  if (status === 403) return "No tienes permisos para esta acción.";
  if (status >= 500) return "La plataforma no está disponible en este momento.";

  return "No se pudo completar la solicitud.";
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  const token = authTokenStore.getAccessToken();
  const shouldAttemptRefresh = Boolean(token) && normalizedPath !== "/auth/refresh";

  let response: Response;
  let attemptedRefresh = false;
  let parsedErrorBody: unknown = undefined;
  try {
    response = await sendApiRequest(normalizedPath, options, token);
  } catch (error) {
    browserLogger.warn("Network request failed.", error);
    throw new Error("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
  }

  if (response.status === 403) {
    parsedErrorBody = await parseErrorBody(response);
    const bannedPayload = extractBannedPayload(parsedErrorBody);

    if (bannedPayload) {
      terminateSession(bannedPayload);
      throw new ApiError(403, resolveErrorMessage(403, bannedPayload), bannedPayload);
    }
  }

  if ((response.status === 401 || response.status === 403) && shouldAttemptRefresh) {
    attemptedRefresh = true;
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      try {
        response = await sendApiRequest(normalizedPath, options, refreshedToken);
      } catch (error) {
        browserLogger.warn("Network request failed after session refresh.", error);
        throw new Error("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
      }
    }
  }

  if (!response.ok) {
    const errorBody = parsedErrorBody ?? await parseErrorBody(response);
    const bannedPayload = extractBannedPayload(errorBody);
    if (bannedPayload) {
      terminateSession(bannedPayload);
      throw new ApiError(response.status, resolveErrorMessage(response.status, bannedPayload), bannedPayload);
    }
    const message = response.status === 401 && attemptedRefresh
      ? "La sesión expiró. Inicia sesión nuevamente."
      : resolveErrorMessage(response.status, errorBody);
    throw new ApiError(response.status, message, errorBody);
  }

  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return response.json() as Promise<T>;
}
