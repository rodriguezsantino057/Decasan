import { Producto } from "./products";

// Pesos predeterminados por categoría o grupo.
// Todas las claves deben estar en minúsculas y normalizadas para coincidir mejor.
// Si una categoría no está en este diccionario, se usará el peso por defecto.
export const CATEGORY_WEIGHTS: Record<string, number> = {
  // Ejemplos (pueden expandirse)
  "motosierras": 8.0,
  "taladros": 2.5,
  "amoladoras": 3.0,
  "atornilladores": 1.5,
  "bordeadoras": 4.5,
  "desmalezadoras": 7.0,
  "hormigoneras": 45.0,
  "compresores": 25.0,
  "soldadoras": 10.0,
  "hidrolavadoras": 8.0,
  "escaleras": 12.0,
  "carretillas": 15.0,
  "generadores": 40.0,
  "bombas de agua": 15.0,
  "cajas de herramientas": 3.0,
  "herramientas manuales": 1.0,
  "pinturas": 5.0, // Asumiendo lata de 4L
  "adhesivos y selladores": 0.5,
  "tornillos y fijaciones": 0.5,
  "electricidad": 0.5,
  "plomeria": 1.0,
  "jardineria": 1.5,
};

// Peso mínimo por paquete para no mandar 0kg a Zipnova
export const DEFAULT_SHIPPING_WEIGHT_KG = 1.0;

function normalizeCategoryKey(cat: string | null | undefined): string {
  if (!cat) return "";
  return cat
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Calcula el peso en kilogramos de un producto.
 * 1. Si el producto tiene un `peso_kg` explícito, lo usa.
 * 2. Si no, busca la categoría en el diccionario `CATEGORY_WEIGHTS`.
 * 3. Si no, busca el grupo en el diccionario.
 * 4. Si nada coincide, usa el peso por defecto (`DEFAULT_SHIPPING_WEIGHT_KG`).
 */
export function getProductWeight(producto: Pick<Producto, "peso_kg" | "categoria" | "grupo">): number {
  if (producto.peso_kg != null && producto.peso_kg > 0) {
    return Number(producto.peso_kg);
  }

  const catNorm = normalizeCategoryKey(producto.categoria);
  if (catNorm && CATEGORY_WEIGHTS[catNorm]) {
    return CATEGORY_WEIGHTS[catNorm];
  }

  const grupoNorm = normalizeCategoryKey(producto.grupo);
  if (grupoNorm && CATEGORY_WEIGHTS[grupoNorm]) {
    return CATEGORY_WEIGHTS[grupoNorm];
  }

  return DEFAULT_SHIPPING_WEIGHT_KG;
}
