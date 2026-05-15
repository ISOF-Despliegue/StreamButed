import { authTokenStore } from "./authTokenStore";
import type { ApiErrorPayload, ApiRequestOptions } from "../types/api.types";
import { browserLogger } from "../utils/browserLogger";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost";

const API_PREFIX = "/api/v1";

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
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const withoutPrefix = normalizedPath.startsWith(API_PREFIX)
    ? normalizedPath.slice(API_PREFIX.length)
    : normalizedPath;

  return `${API_BASE_URL}${API_PREFIX}${withoutPrefix}`;
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
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
