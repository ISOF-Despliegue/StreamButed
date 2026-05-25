type FormatCountOptions = {
  compact?: boolean;
};

export function formatNumber(value: number | null | undefined, options: FormatCountOptions = {}): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const normalizedValue = Math.round(value);

  return new Intl.NumberFormat("es-MX", {
    notation: options.compact !== false && normalizedValue >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(normalizedValue);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.floor(seconds % 60));
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
}
