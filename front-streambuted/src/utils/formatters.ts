type FormatCountOptions = {
  compact?: boolean;
};

const APP_DATE_TIME_ZONE = "America/Mexico_City";
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const appDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_DATE_TIME_ZONE,
  year: "numeric",
});

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

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}-${month}-${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const parts = appDateFormatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!day || !month || !year) {
    return "--";
  }

  return `${day}-${month}-${year}`;
}
