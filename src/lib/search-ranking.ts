// Utilidades compartidas de búsqueda y ranking de productos.
// Usadas por el catálogo (products.ts) y el admin (admin.functions.ts).

export function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenizeSearch(q?: string) {
  return normalizeSearch(q)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export type SearchableProduct = {
  nombre?: string | null;
  sku?: string | null;
  grupo?: string | null;
  categoria?: string | null;
  descripcion?: string | null;
};

/**
 * Puntúa un producto según qué tan relevante es para los tokens buscados.
 * Prioriza los nombres que EMPIEZAN con el término (ej. "TALADRO DE BANCO"
 * al buscar "taladro") por encima de los que solo lo contienen en el medio.
 */
export function scoreProductSearch(product: SearchableProduct, tokens: string[]) {
  const name = normalizeSearch(product.nombre);
  const sku = normalizeSearch(product.sku);
  const group = normalizeSearch(product.grupo);
  const category = normalizeSearch(product.categoria);
  const description = normalizeSearch(product.descripcion);
  let total = 0;

  for (const token of tokens) {
    let tokenScore = 0;
    const words = name.split(" ");
    const firstWord = words[0] ?? "";
    if (name === token) tokenScore = Math.max(tokenScore, 1500);
    if (firstWord === token) tokenScore = Math.max(tokenScore, 1400);
    if (firstWord.startsWith(token)) tokenScore = Math.max(tokenScore, 1300);
    if (words.some((word) => word === token)) tokenScore = Math.max(tokenScore, 1000);
    if (words.some((word) => word.startsWith(token))) tokenScore = Math.max(tokenScore, 850);
    if (name.includes(token)) tokenScore = Math.max(tokenScore, 700);
    if (sku === token) tokenScore = Math.max(tokenScore, 650);
    if (sku.includes(token)) tokenScore = Math.max(tokenScore, 500);
    if (group.includes(token)) tokenScore = Math.max(tokenScore, 280);
    if (category.includes(token)) tokenScore = Math.max(tokenScore, 220);
    if (description.includes(token)) tokenScore = Math.max(tokenScore, 60);
    if (!tokenScore) return 0;
    total += tokenScore;
  }

  if (name.includes(tokens.join(" "))) total += 500;
  return total;
}