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

interface MessageRule {
  readonly patterns: readonly string[];
  readonly result: string;
}

function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function isPublicErrorCode(code: string): code is keyof typeof PUBLIC_ERROR_MESSAGES {
  return Object.hasOwn(PUBLIC_ERROR_MESSAGES, code);
}

function looksLikeInternalError(message: string): boolean {
  const normalized = normalizeMessage(message);
  return INTERNAL_ERROR_MARKERS.some((marker) => normalized.includes(marker));
}

function inferFromCombinedText(combined: string): PublicErrorCode | null {
  if (includesAny(combined, ["timeout", "deadline exceeded", "tardo demasiado"])) {
    return "request_timeout";
  }

  if (includesAny(combined, [
    "serviceunavailable",
    "not available",
    "unavailable",
    "no esta disponible temporalmente",
  ])) {
    return "service_temporarily_unavailable";
  }

  if (includesAny(combined, [
    "dependency_validation_failed",
    "no pudo validar",
    "no es accesible",
  ])) {
    return "dependency_validation_failed";
  }

  if (includesAny(combined, ["conflict", "resource changed", "changed"])) {
    return "conflict_or_state_changed";
  }

  return null;
}

function inferFromStatus(status: number | null | undefined, hasDescriptorData: boolean): PublicErrorCode | null {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "resource_not_found";
  if (status === 408 || status === 504) return "request_timeout";
  if (status === 409) return "conflict_or_state_changed";
  if ((status === 422 || status === 400) && hasDescriptorData) return "invalid_input";
  if (status !== null && status !== undefined && status >= 500) return "service_temporarily_unavailable";

  return null;
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

  return inferFromCombinedText(combined) ?? inferFromStatus(status, Boolean(message || error || code));
}

const USER_FACING_MESSAGE_RULES: readonly MessageRule[] = [
  {
    patterns: ["invalid email or password", "invalid credentials", "bad credentials"],
    result: "El correo o la contraseña son incorrectos.",
  },
  {
    patterns: [
      "codigo de recuperacion es incorrecto",
      "password reset code is incorrect",
      "password reset code invalid",
    ],
    result: "El código de recuperación es incorrecto.",
  },
  {
    patterns: [
      "verification code is incorrect",
      "verification code invalid",
      "codigo de verificacion es incorrecto",
    ],
    result: "El código de verificación es incorrecto.",
  },
  {
    patterns: ["verification code has expired"],
    result: "El código de verificación expiró. Solicita uno nuevo.",
  },
  {
    patterns: ["codigo de recuperacion expiro", "password reset code has expired"],
    result: "El código de recuperación expiró. Solicita uno nuevo.",
  },
  {
    patterns: ["verification code must contain 6 digits"],
    result: "El código debe tener 6 dígitos.",
  },
  {
    patterns: ["verification attempt id is required"],
    result: "No se pudo validar la verificación. Solicita un nuevo código.",
  },
  {
    patterns: ["email must be a valid address"],
    result: "Correo inválido.",
  },
  {
    patterns: ["email must not exceed 320 characters"],
    result: "El correo no puede superar 320 caracteres.",
  },
  {
    patterns: ["username must be between 3 and 100 characters", "username must be between 3 and 50 characters"],
    result: "El nombre de usuario debe tener entre 3 y 100 caracteres.",
  },
  {
    patterns: ["password must be between 8 and 15 characters"],
    result: "La contraseña debe tener entre 8 y 15 caracteres.",
  },
  {
    patterns: ["password confirmation must be between 8 and 15 characters"],
    result: "La confirmación de contraseña debe tener entre 8 y 15 caracteres.",
  },
  {
    patterns: ["must not be blank", "is required"],
    result: "Todos los campos son obligatorios.",
  },
  {
    patterns: ["password confirmation does not match"],
    result: "Las contraseñas no coinciden.",
  },
  {
    patterns: ["password must contain at least one uppercase letter"],
    result: "La contraseña debe incluir al menos una mayúscula.",
  },
  {
    patterns: ["password must contain at least one number"],
    result: "La contraseña debe incluir al menos un número.",
  },
  {
    patterns: ["password must contain at least one special character"],
    result: "La contraseña debe incluir al menos un símbolo especial.",
  },
  {
    patterns: ["email is already registered", "email already exists"],
    result: "Ese correo ya está registrado. Inicia sesión o usa otro correo.",
  },
  {
    patterns: ["no existe ninguna cuenta asociada a ese correo", "password reset account not found"],
    result: "No existe ninguna cuenta asociada a ese correo.",
  },
  {
    patterns: ["username is already in use", "username already exists"],
    result: "Ese nombre de usuario ya está en uso. Elige otro.",
  },
  {
    patterns: ["registration cannot be completed"],
    result: "No se pudo completar el registro con esos datos.",
  },
  {
    patterns: ["refresh token is invalid"],
    result: "Tu sesión expiró. Inicia sesión nuevamente.",
  },
  {
    patterns: ["session refresh failed"],
    result: "No pudimos actualizar tu sesión. Inicia sesión nuevamente.",
  },
  {
    patterns: ["access denied", "forbidden"],
    result: "No tienes permisos para esta acción.",
  },
  {
    patterns: ["you already have a playlist with that name", "playlistnamealreadyexists"],
    result: "Ya existe una playlist con ese nombre.",
  },
  {
    patterns: [
      "this song is already in that playlist",
      "esta cancion ya se encuentra en esa playlist",
      "trackalreadyinplaylist",
    ],
    result: "Esta canción ya se encuentra en esa playlist.",
  },
  {
    patterns: ["not found"],
    result: "No encontramos la información solicitada.",
  },
];

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
  const matchedRule = USER_FACING_MESSAGE_RULES.find((rule) => includesAny(normalized, rule.patterns));
  if (matchedRule) {
    return matchedRule.result;
  }

  if (
    includesAny(normalized, [
      "network_unreachable",
      "service_temporarily_unavailable",
      "request_timeout",
      "resource_not_found",
      "invalid_input",
      "forbidden",
      "unauthorized",
      "conflict_or_state_changed",
      "dependency_validation_failed",
      "unexpected_operation_failure",
    ])
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
