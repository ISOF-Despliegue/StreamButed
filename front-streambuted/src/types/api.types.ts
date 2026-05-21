export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  error?: string;
  details?: unknown;
  statusCode?: number;
  banType?: "TEMPORARY" | "PERMANENT";
  bannedUntil?: string | null;
  remainingSeconds?: number;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  method?: HttpMethod;
  body?: BodyInit | object | null;
}
