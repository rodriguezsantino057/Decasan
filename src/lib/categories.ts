export const DEFAULT_CATEGORIES = [
  "Accesorios y Herramientas",
  "Automotor",
  "Bateria",
  "H. Eléctricas",
  "Sanitarios e instalaciones",
  "Jardín",
  "Materiales",
] as const;

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
    .filter((category): category is string => !!category && !defaults.includes(category));

  return [...defaults, ...Array.from(new Set(extra)).sort((a, b) => a.localeCompare(b, "es-AR"))];
}
