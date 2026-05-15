import { authTokenStore } from "./authTokenStore";
import type { ApiErrorPayload, ApiRequestOptions } from "../types/api.types";
import { browserLogger } from "../utils/browserLogger";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost";

const API_PREFIX = "/api/v1";
const API_BASE = new URL(`${API_BASE_URL}/`);
const API_BASE_PATH = API_BASE.pathname === "/" ? "" : API_BASE.pathname.replace(/\/$/, "");

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
  const withoutPrefix = normalizedPath.startsWith(API_PREFIX)
    ? normalizedPath.slice(API_PREFIX.length)
    : normalizedPath;
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

function isObjectBody(body: unknown): body is object {
  return Boolean(body) && typeof body === "object" && !(body instanceof FormData);
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

  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (status === 401) return "La sesion expiro. Inicia sesion nuevamente.";
  if (status === 403) return "No tienes permisos para esta accion.";
  if (status >= 500) return "El servicio no esta disponible en este momento.";

  return "No se pudo completar la solicitud.";
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = authTokenStore.getAccessToken();
  const headers = new Headers(options.headers);
  if (isObjectBody(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    credentials: "include",
    headers,
    body: isObjectBody(options.body)
      ? JSON.stringify(options.body)
      : (options.body as BodyInit | null | undefined),
  });

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new ApiError(response.status, resolveErrorMessage(response.status, errorBody), errorBody);
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
