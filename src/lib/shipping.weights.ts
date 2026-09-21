import { Producto } from "./products";

// Pesos predeterminados por categoría o grupo.
// Todas las claves deben estar en minúsculas y normalizadas para coincidir mejor.
// Si una categoría no está en este diccionario, se usará el peso por defecto.
export const CATEGORY_WEIGHTS: Record<string, number> = {
  // --- Herramientas Eléctricas (Promedios) ---
  "amoladoras": 3.0,
  "atornilladores": 1.5,
  "taladros": 2.5,
  "motosierras": 8.0,
  "sierras circulares": 5.0,
  "caladoras": 2.5,
  "sierras caladoras": 2.5,
  "rotomartillos": 6.0,
  "lijadoras": 2.0,
  "ingletadoras": 18.0,
  "sierras ingletadoras": 18.0,
  "pistolas de calor": 1.0,
  "fresadoras": 3.5,
  "cepillos electricos": 3.0,
  "llaves": 1.0,
  "llaves de impacto": 3.0,
  "demoledores": 15.0,
  "martillos demoledores": 15.0,
  "sierras e ingletadoras": 12.0,
  "sopladoras y aspiradoras": 5.0,
  "cortacercos": 3.5,
  "minitornos": 1.0,
  "cargadores": 1.0,
  "baterias": 1.0,
  "pistolas": 1.0,
  "pulidoras": 3.0,
  "hojas de sierras": 0.5,
  "tijeras y cortapernos": 1.5,
  "soldadoras": 10.0,
  "soldadoras inverters": 6.0,
  "compresores": 25.0,
  "generadores": 40.0,

  // --- Herramientas de Jardín y Bosque ---
  "bordeadoras": 4.5,
  "desmalezadoras": 7.0,
  "cortadoras de cesped": 15.0,
  "sopladoras": 4.0,
  "hidrolavadoras": 8.0,
  "bombas de agua": 15.0,
  "electrobombas": 15.0,

  // --- Maquinaria Pesada / Construcción ---
  "hormigoneras": 45.0,
  "carretillas": 15.0,
  "escaleras": 12.0,
  "andamios": 25.0,

  // --- Varios / Manuales / Insumos ---
  "cajas de herramientas": 3.0,
  "herramientas manuales": 1.0,
  "pinturas": 5.0, // Asumiendo lata de 4L promedio
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
export function getProductWeight(producto: Pick<Producto, "peso_kg" | "categoria" | "grupo">, dynamicWeights?: Record<string, number>): number {
  if (producto.peso_kg != null && producto.peso_kg > 0) {
    return Number(producto.peso_kg);
  }

  const weights = dynamicWeights ?? CATEGORY_WEIGHTS;

  const catNorm = normalizeCategoryKey(producto.categoria);
  if (catNorm && weights[catNorm] != null) {
    return weights[catNorm];
  }

  const grupoNorm = normalizeCategoryKey(producto.grupo);
  if (grupoNorm && weights[grupoNorm] != null) {
    return weights[grupoNorm];
  }

  return DEFAULT_SHIPPING_WEIGHT_KG;
}
