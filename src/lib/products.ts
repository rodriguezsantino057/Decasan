import { supabase } from "@/integrations/supabase/client";
import { normalizeCategoryName, uniqueSortedCategories } from "@/lib/categories";
import { normalizeSearch, scoreProductSearch, tokenizeSearch } from "@/lib/search-ranking";

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
  peso_kg?: number | null;
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
  isAdmin?: boolean;
}): Promise<{ items: Producto[]; count: number }> {
  let query = supabase.from("productos").select("*", { count: "exact" });
  if (!opts.isAdmin) query = query.or("activo.eq.true,activo.is.null");
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

  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  
  // Fetch up to 2000 items to allow in-memory grouping of in-stock vs out-of-stock
  query = query.limit(2000);

  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Producto[];

  // Fallback: para productos sin portada, traer la primera imagen de la galería
  const withoutCover = rows.filter((r) => !r.image_url).map((r) => r.id);
  if (withoutCover.length > 0) {
    const { data: galleryRows } = await supabase
      .from("product_images")
      .select("producto_id, url, url_webp")
      .in("producto_id", withoutCover)
      .order("orden", { ascending: true });
    if (galleryRows?.length) {
      const firstImageByProduct = new Map<number, { url: string; url_webp: string | null }>();
      for (const g of galleryRows) {
        if (!firstImageByProduct.has(g.producto_id) && g.url) {
          firstImageByProduct.set(g.producto_id, { url: g.url, url_webp: g.url_webp });
        }
      }
      for (const row of rows) {
        const fallback = firstImageByProduct.get(row.id);
        if (fallback) {
          row.image_url = fallback.url;
          row.image_webp = fallback.url_webp;
        }
      }
    }
  }

  let ranked = rows.map((item) => ({ item, score: searchTokens.length ? scoreProductSearch(item, searchTokens) : 1 }));
  if (searchTokens.length) {
    ranked = ranked.filter((entry) => entry.score > 0);
  }

  const hasStock = (p: Producto) => ((p.stock ?? 0) > 0 ? 1 : 0);

  switch (opts.sort) {
    case "price-asc":
      ranked.sort((a, b) => hasStock(b.item) - hasStock(a.item) || getPrecioEfectivo(a.item) - getPrecioEfectivo(b.item) || b.score - a.score);
      break;
    case "price-desc":
      ranked.sort((a, b) => hasStock(b.item) - hasStock(a.item) || getPrecioEfectivo(b.item) - getPrecioEfectivo(a.item) || b.score - a.score);
      break;
    case "name-asc":
      ranked.sort((a, b) => hasStock(b.item) - hasStock(a.item) || (a.item.nombre ?? "").localeCompare(b.item.nombre ?? "", "es"));
      break;
    default:
      ranked.sort(
        (a, b) =>
          hasStock(b.item) - hasStock(a.item) ||
          b.score - a.score ||
          Number(b.item.stock ?? 0) - Number(a.item.stock ?? 0) ||
          (a.item.nombre ?? "").localeCompare(b.item.nombre ?? "", "es"),
      );
  }

  return {
    items: ranked.slice(offset, offset + limit).map((entry) => entry.item),
    count: searchTokens.length ? ranked.length : (count ?? ranked.length),
  };
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

function escapePostgrestLike(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

export async function fetchProducto(id: number, isAdmin?: boolean): Promise<Producto | null> {
  let query = supabase.from("productos").select("*").eq("id", id);
  if (!isAdmin) query = query.or("activo.eq.true,activo.is.null");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Fallback: si no tiene portada, traer la primera imagen de la galería
  if (!data.image_url) {
    const { data: galleryRow } = await supabase
      .from("product_images")
      .select("url, url_webp")
      .eq("producto_id", id)
      .order("orden", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (galleryRow?.url) {
      data.image_url = galleryRow.url;
      data.image_webp = galleryRow.url_webp;
    }
  }

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

export async function fetchCategorias(isAdmin?: boolean): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("categorias")
    .select("nombre")
    .eq("activo", true)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true });

  if (!error) return uniqueSortedCategories((data ?? []).map((c: { nombre: string | null }) => c.nombre));

  let fallbackQuery = supabase.from("productos").select("categoria");
  if (!isAdmin) fallbackQuery = fallbackQuery.or("activo.eq.true,activo.is.null");
  const fallback = await fallbackQuery;
  if (fallback.error) throw fallback.error;
  return uniqueSortedCategories((fallback.data ?? []).map((r: { categoria: string | null }) => r.categoria));
}

export async function fetchGrupos(isAdmin?: boolean, cat?: string): Promise<string[]> {
  const allGrupos: string[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase
      .from("productos")
      .select("grupo")
      .not("grupo", "is", null)
      .not("grupo", "eq", "");
    if (!isAdmin) q = q.or("activo.eq.true,activo.is.null");
    if (cat) q = q.eq("categoria", normalizeCategoryName(cat));

    const { data, error } = await q
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

export async function fetchPriceRange(isAdmin?: boolean): Promise<{ min: number; max: number }> {
  let q1 = supabase.from("productos").select("precio");
  let q2 = supabase.from("productos").select("precio");
  if (!isAdmin) {
    q1 = q1.or("activo.eq.true,activo.is.null");
    q2 = q2.or("activo.eq.true,activo.is.null");
  }
  const [{ data: lo }, { data: hi }] = await Promise.all([
    q1.order("precio", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    q2.order("precio", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ]);
  return {
    min: Math.floor(Number(lo?.precio ?? 0)),
    max: Math.ceil(Number(hi?.precio ?? 0)),
  };
}
