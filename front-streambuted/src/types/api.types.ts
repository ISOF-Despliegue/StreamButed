export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorPayload {
  message?: string;
  error?: string;
  details?: unknown;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  method?: HttpMethod;
  body?: BodyInit | object | null;
}
