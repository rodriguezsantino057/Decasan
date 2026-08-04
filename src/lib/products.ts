import { supabase } from "@/integrations/supabase/client";
import { normalizeCategoryName, uniqueSortedCategories } from "@/lib/categories";

export type Producto = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  categoria: string | null;
  grupo: string | null;
  sku: string | null;
  precio: number | null;
  stock: number | null;
  image_url?: string | null;
  image_webp?: string | null;
  activo?: boolean;
  precio_oferta?: number | null;
  oferta_hasta?: string | null;
};

export type ProductImageRow = {
  id: string;
  producto_id: number;
  url: string | null;
  url_webp: string | null;
  alt: string | null;
  orden: number;
};

export type SortKey = "relevance" | "price-asc" | "price-desc" | "name-asc";

const SEARCH_FIELDS = ["nombre", "sku", "grupo", "categoria", "descripcion"] as const;

export function getPrecioEfectivo(p: Pick<Producto, "precio" | "precio_oferta" | "oferta_hasta">): number {
  const base = Number(p.precio ?? 0);
  if (
    p.precio_oferta != null &&
    Number(p.precio_oferta) > 0 &&
    (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date())
  ) {
    return Number(p.precio_oferta);
  }
  return base;
}

export function tieneOferta(p: Pick<Producto, "precio" | "precio_oferta" | "oferta_hasta">): boolean {
  return getPrecioEfectivo(p) < Number(p.precio ?? 0);
}

export async function fetchProductos(opts: {
  q?: string;
  cat?: string;
  grupo?: string;
  min?: number;
  max?: number;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}): Promise<{ items: Producto[]; count: number }> {
  let query = supabase.from("productos").select("*", { count: "exact" });
  const searchTokens = tokenizeSearch(opts.q);

  const normalizedCat = normalizeCategoryName(opts.cat);
  if (normalizedCat) query = query.eq("categoria", normalizedCat);
  if (opts.grupo) query = query.eq("grupo", opts.grupo);
  if (typeof opts.min === "number") query = query.gte("precio", opts.min);
  if (typeof opts.max === "number") query = query.lte("precio", opts.max);
  if (searchTokens.length) {
    const clauses = buildQueryTokens(opts.q).flatMap((token) =>
      SEARCH_FIELDS.map((field) => `${field}.ilike.%${escapePostgrestLike(token)}%`),
    );
    query = query.or(clauses.join(","));
  }

  if (!searchTokens.length || opts.sort !== "relevance") {
    switch (opts.sort) {
      case "price-asc":
        query = query.order("precio", { ascending: true, nullsFirst: false });
        break;
      case "price-desc":
        query = query.order("precio", { ascending: false, nullsFirst: false });
        break;
      case "name-asc":
        query = query.order("nombre", { ascending: true });
        break;
      default:
        query = query.order("id", { ascending: true });
    }
  }

  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  if (searchTokens.length) {
    query = query.limit(Math.max(offset + limit, 120));
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Producto[];

  if (!searchTokens.length) {
    return { items: rows, count: count ?? 0 };
  }

  const ranked = rows
    .map((item) => ({ item, score: scoreProductSearch(item, searchTokens) }))
    .filter((entry) => entry.score > 0);

  switch (opts.sort) {
    case "price-asc":
      ranked.sort((a, b) => getPrecioEfectivo(a.item) - getPrecioEfectivo(b.item) || b.score - a.score);
      break;
    case "price-desc":
      ranked.sort((a, b) => getPrecioEfectivo(b.item) - getPrecioEfectivo(a.item) || b.score - a.score);
      break;
    case "name-asc":
      ranked.sort((a, b) => (a.item.nombre ?? "").localeCompare(b.item.nombre ?? "", "es"));
      break;
    default:
      ranked.sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.item.stock ?? 0) - Number(a.item.stock ?? 0) ||
          (a.item.nombre ?? "").localeCompare(b.item.nombre ?? "", "es"),
      );
  }

  return {
    items: ranked.slice(offset, offset + limit).map((entry) => entry.item),
    count: ranked.length,
  };
}

function tokenizeSearch(q?: string) {
  return normalizeSearch(q)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildQueryTokens(q?: string) {
  const rawTokens = (q ?? "")
    .toLowerCase()
    .replace(/[%,()]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return Array.from(new Set([...rawTokens, ...tokenizeSearch(q)]));
}

function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapePostgrestLike(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

function scoreProductSearch(product: Producto, tokens: string[]) {
  const name = normalizeSearch(product.nombre);
  const sku = normalizeSearch(product.sku);
  const group = normalizeSearch(product.grupo);
  const category = normalizeSearch(product.categoria);
  const description = normalizeSearch(product.descripcion);
  let total = 0;

  for (const token of tokens) {
    let tokenScore = 0;
    if (name === token) tokenScore = Math.max(tokenScore, 1200);
    if (name.split(" ").some((word) => word === token)) tokenScore = Math.max(tokenScore, 1000);
    if (name.split(" ").some((word) => word.startsWith(token))) tokenScore = Math.max(tokenScore, 850);
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

export async function fetchProducto(id: number): Promise<Producto | null> {
  const { data, error } = await supabase.from("productos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Producto | null;
}

export async function fetchProductoImagenes(productoId: number): Promise<ProductImageRow[]> {
  const { data, error } = await (supabase as any)
    .from("product_images")
    .select("*")
    .eq("producto_id", productoId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductImageRow[];
}

export async function fetchCategorias(): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("categorias")
    .select("nombre")
    .eq("activo", true)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true });

  if (!error) return uniqueSortedCategories((data ?? []).map((c: { nombre: string | null }) => c.nombre));

  const fallback = await supabase.from("productos").select("categoria");
  if (fallback.error) throw fallback.error;
  return uniqueSortedCategories((fallback.data ?? []).map((r: { categoria: string | null }) => r.categoria));
}

export async function fetchGrupos(): Promise<string[]> {
  const allGrupos: string[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("grupo")
      .not("grupo", "is", null)
      .not("grupo", "eq", "")
      .order("grupo")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    allGrupos.push(...(data ?? []).map((p: any) => p.grupo));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return [...new Set(allGrupos.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

export async function fetchPriceRange(): Promise<{ min: number; max: number }> {
  const [{ data: lo }, { data: hi }] = await Promise.all([
    supabase.from("productos").select("precio").order("precio", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("productos").select("precio").order("precio", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ]);
  return {
    min: Math.floor(Number(lo?.precio ?? 0)),
    max: Math.ceil(Number(hi?.precio ?? 0)),
  };
}
