export const DEFAULT_CATEGORIES = [
  "Accesorios y Herramientas",
  "Automotor",
  "H. Eléctricas",
  "Sanitarios e instalaciones",
  "Jardín",
  "Materiales",
  "Materiales Eléctricos",
] as const;

export function isNumericCategory(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) || !isNaN(Number(trimmed));
}

export function normalizeCategoryName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const key = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*/g, ".")
    .toLowerCase();

  if (
    key === "h.electricas" ||
    key === "h electricas" ||
    key === "herramientas electricas" ||
    trimmed === "H. ElÃ©ctricas"
  ) {
    return "H. Eléctricas";
  }

  if (key === "jardin" || trimmed === "JardÃ­n") return "Jardín";

  const match = DEFAULT_CATEGORIES.find(
    (category) =>
      category
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase() === key,
  );

  return match ?? trimmed;
}

export function uniqueSortedCategories(values: Array<string | null | undefined>): string[] {
  const defaults = DEFAULT_CATEGORIES.map((category) => category);
  const extra = values
    .map(normalizeCategoryName)
    .filter((category): category is string => !!category && !isNumericCategory(category) && !defaults.includes(category as any));

  return [...defaults, ...Array.from(new Set(extra)).sort((a, b) => a.localeCompare(b, "es-AR"))];
}

