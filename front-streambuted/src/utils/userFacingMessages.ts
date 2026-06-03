const DEFAULT_FALLBACK_MESSAGE = "No se pudo completar la solicitud.";

const INTERNAL_ERROR_MARKERS = [
  "jwks",
  "grpc",
  "rabbitmq",
  "minio",
  "prisma",
  "postgres",
  "mongodb",
  "redis",
  "dns",
  "identity service",
  "catalog service",
  "media service",
  "analytics service",
  "streaming service",
  "live service",
  "database",
  "stack trace",
];

export const PUBLIC_ERROR_MESSAGES = {
  conflict_or_state_changed: "El contenido cambió y no se pudo completar la acción. Intenta nuevamente.",
  dependency_validation_failed: "No se pudo validar la información relacionada con esta acción. Intenta nuevamente.",
  invalid_input: "La solicitud no cumple con el formato esperado.",
  network_unreachable: "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
  request_timeout: "La solicitud tardó demasiado y no se pudo completar. Intenta nuevamente.",
  resource_not_found: "El contenido solicitado ya no está disponible.",
  service_temporarily_unavailable: "Esta función no está disponible en este momento. Intenta de nuevo más tarde.",
  unauthorized: "Tu sesión expiró. Inicia sesión nuevamente.",
  unexpected_operation_failure: "No se pudo completar la acción en este momento. Intenta de nuevo más tarde.",
  forbidden: "No tienes permisos para esta acción.",
} as const;

export type PublicErrorCode = keyof typeof PUBLIC_ERROR_MESSAGES | "ACCOUNT_BANNED";

interface PublicErrorDescriptor {
  code?: string | null;
  error?: string | null;
  message?: string | null;
  status?: number | null;
}

function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPublicErrorCode(code: string): code is keyof typeof PUBLIC_ERROR_MESSAGES {
  return Object.prototype.hasOwnProperty.call(PUBLIC_ERROR_MESSAGES, code);
}

function looksLikeInternalError(message: string): boolean {
  const normalized = normalizeMessage(message);
  return INTERNAL_ERROR_MARKERS.some((marker) => normalized.includes(marker));
}

function inferPublicErrorCode({
  code,
  error,
  message,
  status,
}: PublicErrorDescriptor): PublicErrorCode | null {
  if (code === "ACCOUNT_BANNED" || error === "AccountBannedException") {
    return "ACCOUNT_BANNED";
  }

  if (typeof code === "string" && isPublicErrorCode(code)) {
    return code;
  }

  const normalizedMessage = normalizeMessage(message ?? "");
  const normalizedError = normalizeMessage(error ?? "");
  const normalizedCode = normalizeMessage(code ?? "");
  const combined = `${normalizedCode} ${normalizedError} ${normalizedMessage}`.trim();

  if (
    combined.includes("timeout")
    || combined.includes("deadline exceeded")
    || combined.includes("tardo demasiado")
  ) {
    return "request_timeout";
  }

  if (
    combined.includes("serviceunavailable")
    || combined.includes("not available")
    || combined.includes("unavailable")
    || combined.includes("no esta disponible temporalmente")
  ) {
    return "service_temporarily_unavailable";
  }

  if (
    combined.includes("dependency_validation_failed")
    || combined.includes("no pudo validar")
    || combined.includes("no es accesible")
  ) {
    return "dependency_validation_failed";
  }

  if (
    combined.includes("conflict")
    || combined.includes("resource changed")
    || combined.includes("changed")
  ) {
    return "conflict_or_state_changed";
  }

  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "resource_not_found";
  if (status === 408 || status === 504) return "request_timeout";
  if (status === 409) return "conflict_or_state_changed";
  if ((status === 422 || status === 400) && (message || error || code)) return "invalid_input";
  if (status !== null && status !== undefined && status >= 500) return "service_temporarily_unavailable";

  return null;
}

export function getPublicErrorMessage(descriptor: PublicErrorDescriptor): string {
  const publicCode = inferPublicErrorCode(descriptor);
  if (publicCode === "ACCOUNT_BANNED") {
    return descriptor.message?.trim() || "Tu cuenta no está disponible en este momento.";
  }

  if (publicCode && looksLikeInternalError(descriptor.message ?? "")) {
    return PUBLIC_ERROR_MESSAGES[publicCode];
  }

  if (descriptor.message) {
    const translatedMessage = toUserFacingMessage(descriptor.message);
    if (translatedMessage !== descriptor.message || !looksLikeInternalError(translatedMessage)) {
      return translatedMessage;
    }
  }

  if (descriptor.error) {
    const translatedError = toUserFacingMessage(descriptor.error);
    if (translatedError !== descriptor.error || !looksLikeInternalError(translatedError)) {
      return translatedError;
    }
  }

  if (
    publicCode
    && (descriptor.message || descriptor.error || descriptor.code || (descriptor.status ?? 0) >= 500)
  ) {
    return PUBLIC_ERROR_MESSAGES[publicCode];
  }

  return DEFAULT_FALLBACK_MESSAGE;
}

export function toUserFacingMessage(message: string | null | undefined): string {
  if (!message) return DEFAULT_FALLBACK_MESSAGE;

  const normalized = normalizeMessage(message);

  if (
    normalized.includes("invalid email or password")
    || normalized.includes("invalid credentials")
    || normalized.includes("bad credentials")
  ) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (
    normalized.includes("codigo de recuperacion es incorrecto")
    || normalized.includes("password reset code is incorrect")
    || normalized.includes("password reset code invalid")
  ) {
    return "El código de recuperación es incorrecto.";
  }

  if (
    normalized.includes("verification code is incorrect")
    || normalized.includes("verification code invalid")
    || normalized.includes("codigo de verificacion es incorrecto")
  ) {
    return "El código de verificación es incorrecto.";
  }

  if (normalized.includes("verification code has expired")) {
    return "El código de verificación expiró. Solicita uno nuevo.";
  }

  if (
    normalized.includes("codigo de recuperacion expiro")
    || normalized.includes("password reset code has expired")
  ) {
    return "El código de recuperación expiró. Solicita uno nuevo.";
  }

  if (normalized.includes("verification code must contain 6 digits")) {
    return "El código debe tener 6 dígitos.";
  }

  if (normalized.includes("verification attempt id is required")) {
    return "No se pudo validar la verificación. Solicita un nuevo código.";
  }

  if (normalized.includes("email must be a valid address")) {
    return "Correo inválido.";
  }

  if (normalized.includes("email must not exceed 320 characters")) {
    return "El correo no puede superar 320 caracteres.";
  }

  if (
    normalized.includes("username must be between 3 and 100 characters")
    || normalized.includes("username must be between 3 and 50 characters")
  ) {
    return "El nombre de usuario debe tener entre 3 y 100 caracteres.";
  }

  if (normalized.includes("password must be between 8 and 15 characters")) {
    return "La contraseña debe tener entre 8 y 15 caracteres.";
  }

  if (normalized.includes("password confirmation must be between 8 and 15 characters")) {
    return "La confirmación de contraseña debe tener entre 8 y 15 caracteres.";
  }

  if (normalized.includes("must not be blank") || normalized.includes("is required")) {
    return "Todos los campos son obligatorios.";
  }

  if (normalized.includes("password confirmation does not match")) {
    return "Las contraseñas no coinciden.";
  }

  if (normalized.includes("password must contain at least one uppercase letter")) {
    return "La contraseña debe incluir al menos una mayúscula.";
  }

  if (normalized.includes("password must contain at least one number")) {
    return "La contraseña debe incluir al menos un número.";
  }

  if (normalized.includes("password must contain at least one special character")) {
    return "La contraseña debe incluir al menos un símbolo especial.";
  }

  if (
    normalized.includes("email is already registered")
    || normalized.includes("email already exists")
  ) {
    return "Ese correo ya está registrado. Inicia sesión o usa otro correo.";
  }

  if (
    normalized.includes("no existe ninguna cuenta asociada a ese correo")
    || normalized.includes("password reset account not found")
  ) {
    return "No existe ninguna cuenta asociada a ese correo.";
  }

  if (
    normalized.includes("username is already in use")
    || normalized.includes("username already exists")
  ) {
    return "Ese nombre de usuario ya está en uso. Elige otro.";
  }

  if (normalized.includes("registration cannot be completed")) {
    return "No se pudo completar el registro con esos datos.";
  }

  if (normalized.includes("refresh token is invalid")) {
    return "Tu sesión expiró. Inicia sesión nuevamente.";
  }

  if (normalized.includes("session refresh failed")) {
    return "No pudimos actualizar tu sesión. Inicia sesión nuevamente.";
  }

  if (normalized.includes("access denied") || normalized.includes("forbidden")) {
    return "No tienes permisos para esta acción.";
  }

  if (
    normalized.includes("you already have a playlist with that name")
    || normalized.includes("playlistnamealreadyexists")
  ) {
    return "Ya existe una playlist con ese nombre.";
  }

  if (
    normalized.includes("this song is already in that playlist")
    || normalized.includes("esta cancion ya se encuentra en esa playlist")
    || normalized.includes("trackalreadyinplaylist")
  ) {
    return "Esta canción ya se encuentra en esa playlist.";
  }

  if (normalized.includes("not found")) {
    return "No encontramos la información solicitada.";
  }

  if (
    normalized.includes("network_unreachable")
    || normalized.includes("service_temporarily_unavailable")
    || normalized.includes("request_timeout")
    || normalized.includes("resource_not_found")
    || normalized.includes("invalid_input")
    || normalized.includes("forbidden")
    || normalized.includes("unauthorized")
    || normalized.includes("conflict_or_state_changed")
    || normalized.includes("dependency_validation_failed")
    || normalized.includes("unexpected_operation_failure")
  ) {
    const publicCode = inferPublicErrorCode({ code: normalized });
    return publicCode && publicCode !== "ACCOUNT_BANNED"
      ? PUBLIC_ERROR_MESSAGES[publicCode]
      : DEFAULT_FALLBACK_MESSAGE;
  }

  if (looksLikeInternalError(message)) {
    const publicCode = inferPublicErrorCode({ message });
    if (publicCode && publicCode !== "ACCOUNT_BANNED") {
      return PUBLIC_ERROR_MESSAGES[publicCode];
    }
    return DEFAULT_FALLBACK_MESSAGE;
  }

  return message;
}
