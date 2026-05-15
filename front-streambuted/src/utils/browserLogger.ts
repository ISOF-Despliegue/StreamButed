type LogMetadata = unknown;

function writeToConsole(
  method: "info" | "warn" | "error",
  message: string,
  metadata: LogMetadata[]
): void {
  console[method](message, ...metadata);
}

export const browserLogger = {
  info(message: string, ...metadata: LogMetadata[]): void {
    writeToConsole("info", message, metadata);
  },

  warn(message: string, ...metadata: LogMetadata[]): void {
    writeToConsole("warn", message, metadata);
  },

  error(message: string, ...metadata: LogMetadata[]): void {
    writeToConsole("error", message, metadata);
  }
};
