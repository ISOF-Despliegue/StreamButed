const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|password|confirmPassword|attemptId|verificationCode|resetCode/i;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/playbackToken=[^&\s]+/gi, "playbackToken=[REDACTED]")
    .replace(/("?(?:accessToken|refreshToken|password|confirmPassword|attemptId|verificationCode|resetCode)"?\s*:\s*")([^"]+)"/gi, '$1[REDACTED]"');
}

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: redactString(error.message),
    stack: error.stack ? redactString(error.stack) : undefined,
  };
}

function sanitizeMetadata(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item, seen));
  }

  const sanitizedEntries = Object.entries(value).map(([key, entryValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return [key, "[REDACTED]"];
    }
    return [key, sanitizeMetadata(entryValue, seen)];
  });

  return Object.fromEntries(sanitizedEntries);
}

function writeToConsole(
  method: "info" | "warn" | "error",
  message: string,
  metadata: unknown[]
): void {
  console[method](redactString(message), ...metadata.map((item) => sanitizeMetadata(item)));
}

export const browserLogger = {
  info(message: string, ...metadata: unknown[]): void {
    writeToConsole("info", message, metadata);
  },

  warn(message: string, ...metadata: unknown[]): void {
    writeToConsole("warn", message, metadata);
  },

  error(message: string, ...metadata: unknown[]): void {
    writeToConsole("error", message, metadata);
  }
};
