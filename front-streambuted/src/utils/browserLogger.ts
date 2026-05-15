function writeToConsole(
  method: "info" | "warn" | "error",
  message: string,
  metadata: unknown[]
): void {
  console[method](message, ...metadata);
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
