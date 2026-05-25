export function sanitizeSearchTerm(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeSearchMatchValue(value: string): string {
  return sanitizeSearchTerm(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function includesSearchTerm(
  value: string | null | undefined,
  searchTerm: string
): boolean {
  const normalizedSearchTerm = normalizeSearchMatchValue(searchTerm);
  if (!normalizedSearchTerm) {
    return true;
  }

  return normalizeSearchMatchValue(value ?? "").includes(normalizedSearchTerm);
}
