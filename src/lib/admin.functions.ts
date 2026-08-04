import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeCategoryName, uniqueSortedCategories } from "@/lib/categories";
import type { Transportista } from "@/lib/shipping.functions";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin requerido");
}

export const adminListPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("pedidos")
      .select("id, estado, total, email, nombre, telefono, direccion, envio_total, costo_envio, envio_metodo, transportista, notas, created_at, mp_payment_id, pedido_items(id, nombre, cantidad, subtotal)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdatePedidoEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    estado: z.enum(["pendiente", "pagado", "enviado", "entregado", "cancelado"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("pedidos").update({ estado: data.estado }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AdminShippingRow = {
  id: string;
  transportista: Transportista;
  provincia: string | null;
  costo: number;
  label: string;
  activo: boolean;
  dias_estimados_min: number | null;
  dias_estimados_max: number | null;
};

export const adminListShippingOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminShippingRow[]> => {
    await ensureAdmin(context.supabase, context.userId);
    const selectShippingOptions = (client: any) => client
      .from("shipping_options")
      .select("id, transportista, provincia, costo, label, activo, dias_estimados_min, dias_estimados_max")
      .order("transportista")
      .order("provincia", { nullsFirst: true });

    const primary = await selectShippingOptions(context.supabase);
    const result = primary.error ? await selectShippingOptions(supabaseAdmin) : primary;
    if (result.error) {
      console.error("[admin] shipping options load failed", {
        userClientError: primary.error?.message,
        adminClientError: result.error.message,
      });
      throw new Error(result.error.message);
    }
    const data = result.data;
    return (data ?? []).map((row: any) => ({ ...row, costo: Number(row.costo) }));
  });

export const adminUpdateShippingOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    costo: z.number().nonnegative().optional(),
    activo: z.boolean().optional(),
    dias_estimados_min: z.number().int().min(0).nullable().optional(),
    dias_estimados_max: z.number().int().min(0).nullable().optional(),
  }).refine((value) => (
    value.dias_estimados_min == null
    || value.dias_estimados_max == null
    || value.dias_estimados_min <= value.dias_estimados_max
  ), "El minimo de dias no puede ser mayor al maximo.").parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("shipping_options").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListProductos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    q: z.string().max(100).optional().nullable(),
    page: z.number().int().min(1).max(500).optional(),
    cat: z.string().max(100).optional().nullable(),
    grupo: z.string().max(100).optional().nullable(),
    activo: z.enum(["all", "yes", "no"]).optional(),
    sortBy: z.enum(["id", "nombre", "precio", "stock"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const page = data.page ?? 1;
    const pageSize = 30;
    const sortBy = data.sortBy ?? "id";
    const sortDir = data.sortDir ?? "desc";
    let q = context.supabase
      .from("productos")
      .select("*", { count: "exact" })
      .order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortBy !== "id") q = q.order("id", { ascending: false });
    if (data.q) {
      const term = data.q.replace(/[%_,]/g, "\\$&");
      q = q.or(`nombre.ilike.%${term}%,sku.ilike.%${term}%,codigo_fabricante.ilike.%${term}%`);
    }
    if (data.cat) q = q.eq("categoria", data.cat);
    if (data.grupo) q = q.eq("grupo", data.grupo);
    if (data.activo === "yes") q = q.eq("activo", true);
    if (data.activo === "no") q = q.eq("activo", false);
    q = q.range((page - 1) * pageSize, page * pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, pageSize };
  });

const productoSchema = z.object({
  id: z.number().int().optional(),
  nombre: z.string().trim().min(1).max(255),
  descripcion: z.string().max(5000).optional().nullable(),
  categoria: z.string().max(100).optional().nullable().transform(normalizeCategoryName),
  grupo: z.string().max(100).optional().nullable(),
  sku: z.string().max(80).optional().nullable(),
  codigo_fabricante: z.string().max(120).optional().nullable(),
  precio_vta_sin_iva: z.number().nonnegative().nullable().optional(),
  precio: z.number().nonnegative(),
  stock: z.number().int().min(0),
  image_url: z.string().max(500).optional().nullable(),
  image_webp: z.string().max(500).optional().nullable(),
  activo: z.boolean().optional(),
  precio_oferta: z.number().nonnegative().nullable().optional(),
  oferta_hasta: z.string().nullable().optional(),
});

export const adminUpsertProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("productos").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    } else {
      const { data: inserted, error } = await context.supabase.from("productos").insert(rest).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: inserted?.id as number };
    }
  });

export const adminDeleteProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("productos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === BULK ACTIONS ===

const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_categoria"), ids: z.array(z.number().int()).min(1).max(500), categoria: z.string().max(100).nullable().transform(normalizeCategoryName) }),
  z.object({ action: z.literal("set_grupo"), ids: z.array(z.number().int()).min(1).max(500), grupo: z.string().max(100).nullable() }),
  z.object({ action: z.literal("set_activo"), ids: z.array(z.number().int()).min(1).max(500), activo: z.boolean() }),
  z.object({ action: z.literal("adjust_precio_pct"), ids: z.array(z.number().int()).min(1).max(500), pct: z.number().min(-90).max(500) }),
  z.object({ action: z.literal("set_stock"), ids: z.array(z.number().int()).min(1).max(500), stock: z.number().int().min(0).max(1_000_000) }),
  z.object({
    action: z.literal("set_oferta"),
    ids: z.array(z.number().int()).min(1).max(500),
    precio_oferta: z.number().nonnegative().nullable(),
    oferta_hasta: z.string().nullable(),
  }),
  z.object({ action: z.literal("delete"), ids: z.array(z.number().int()).min(1).max(500) }),
]);

export const adminBulkProductos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const sb = context.supabase;

    switch (data.action) {
      case "set_categoria": {
        const { error } = await sb.from("productos").update({ categoria: data.categoria }).in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
      case "set_grupo": {
        const { error } = await sb.from("productos").update({ grupo: data.grupo }).in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
      case "set_activo": {
        const { error } = await sb.from("productos").update({ activo: data.activo }).in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
      case "set_stock": {
        const { error } = await sb.from("productos").update({ stock: data.stock }).in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
      case "set_oferta": {
        if (data.precio_oferta != null && data.precio_oferta < 0) {
          throw new Error("Precio de oferta inválido");
        }
        const { error } = await sb.from("productos").update({
          precio_oferta: data.precio_oferta,
          oferta_hasta: data.oferta_hasta,
        }).in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
      case "adjust_precio_pct": {
        // Read current prices, compute new, update one by one.
        const { data: rows, error: e1 } = await sb.from("productos").select("id, precio").in("id", data.ids);
        if (e1) throw new Error(e1.message);
        const factor = 1 + data.pct / 100;
        let count = 0;
        for (const r of rows ?? []) {
          const current = Number(r.precio ?? 0);
          if (current <= 0) continue;
          const next = Math.max(0, Math.round(current * factor * 100) / 100);
          const { error } = await sb.from("productos").update({ precio: next }).eq("id", r.id);
          if (error) throw new Error(error.message);
          count++;
        }
        return { ok: true, updated: count };
      }
      case "delete": {
        const { error } = await sb.from("productos").delete().in("id", data.ids);
        if (error) throw new Error(error.message);
        return { ok: true, updated: data.ids.length };
      }
    }
  });

const erpImportRowSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  nombre: z.string().trim().min(1).max(255),
  codigo_fabricante: z.string().max(120).optional().nullable(),
  precio_vta_sin_iva: z.number().nonnegative().nullable().optional(),
  precio: z.number().nonnegative(),
  categoria: z.string().max(100).optional().nullable(),
  grupo: z.string().max(100).optional().nullable(),
  stock: z.number().int().optional().nullable(),
  descripcion: z.string().max(5000).optional().nullable(),
  activo: z.boolean().optional().nullable(),
  precio_oferta: z.number().nonnegative().optional().nullable(),
  oferta_hasta: z.string().optional().nullable(),
});

export const adminImportProductosErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    rows: z.array(erpImportRowSchema).min(1).max(5000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const importId = crypto.randomUUID();
    const now = new Date().toISOString();
    const skus = data.rows.map((row) => row.sku);
    const { data: existing, error: readError } = await sb
      .from("productos")
      .select("id, sku")
      .in("sku", skus);
    if (readError) throw new Error(readError.message);

    const bySku = new Map((existing ?? []).map((row: any) => [row.sku, row.id]));
    let created = 0;
    let updated = 0;

    for (const row of data.rows) {
      const payload: any = {
        sku: row.sku,
        nombre: row.nombre,
        codigo_fabricante: row.codigo_fabricante ?? null,
        precio_vta_sin_iva: row.precio_vta_sin_iva ?? null,
        precio: row.precio,
        erp_updated_at: now,
        last_import_id: importId,
      };

      if (row.categoria !== undefined) payload.categoria = row.categoria;
      if (row.grupo !== undefined) payload.grupo = row.grupo;
      if (row.stock !== undefined && row.stock !== null) payload.stock = row.stock;
      if (row.descripcion !== undefined) payload.descripcion = row.descripcion;
      if (row.activo !== undefined && row.activo !== null) payload.activo = row.activo;
      if (row.precio_oferta !== undefined) payload.precio_oferta = row.precio_oferta;
      if (row.oferta_hasta !== undefined) payload.oferta_hasta = row.oferta_hasta;

      const id = bySku.get(row.sku);
      if (id) {
        const { error } = await sb.from("productos").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const insertPayload = {
          ...payload,
          stock: row.stock ?? 0,
          activo: row.activo ?? false,
        };
        const { error } = await sb.from("productos").insert(insertPayload);
        if (error) throw new Error(error.message);
        created++;
      }
    }

    return { ok: true, importId, processed: data.rows.length, created, updated };
  });

export const adminPreviewImportProductosErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    rows: z.array(erpImportRowSchema).min(1).max(5000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const skus = data.rows.map((row) => row.sku);
    const { data: existing, error } = await context.supabase
      .from("productos")
      .select("id, sku, nombre, codigo_fabricante, precio_vta_sin_iva, precio, categoria, grupo, stock, descripcion, activo, precio_oferta, oferta_hasta")
      .in("sku", skus);
    if (error) throw new Error(error.message);

    const bySku = new Map((existing ?? []).map((row: any) => [row.sku, row]));
    const created: typeof data.rows = [];
    const updated: Array<{ row: typeof data.rows[number]; current: any; changes: Array<{ field: string; before: any; after: any }> }> = [];
    let unchanged = 0;

    function sameNumber(a: unknown, b: unknown) {
      if (a == null && b == null) return true;
      const na = Number(a);
      const nb = Number(b);
      return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 0.001;
    }

    for (const row of data.rows) {
      const current = bySku.get(row.sku);
      if (!current) {
        created.push(row);
        continue;
      }
      const changes = [
        { field: "nombre", before: current.nombre, after: row.nombre, same: String(current.nombre ?? "") === row.nombre },
        { field: "codigo_fabricante", before: current.codigo_fabricante, after: row.codigo_fabricante, same: String(current.codigo_fabricante ?? "") === String(row.codigo_fabricante ?? "") },
        { field: "precio_vta_sin_iva", before: current.precio_vta_sin_iva, after: row.precio_vta_sin_iva, same: sameNumber(current.precio_vta_sin_iva, row.precio_vta_sin_iva) },
        { field: "precio", before: current.precio, after: row.precio, same: sameNumber(current.precio, row.precio) },
      ];

      if (row.categoria !== undefined) {
        changes.push({ field: "categoria", before: current.categoria, after: row.categoria, same: String(current.categoria ?? "") === String(row.categoria ?? "") });
      }
      if (row.grupo !== undefined) {
        changes.push({ field: "grupo", before: current.grupo, after: row.grupo, same: String(current.grupo ?? "") === String(row.grupo ?? "") });
      }
      if (row.stock !== undefined && row.stock !== null) {
        changes.push({ field: "stock", before: current.stock, after: row.stock, same: Number(current.stock ?? 0) === Number(row.stock ?? 0) });
      }
      if (row.descripcion !== undefined) {
        changes.push({ field: "descripcion", before: current.descripcion, after: row.descripcion, same: String(current.descripcion ?? "") === String(row.descripcion ?? "") });
      }
      if (row.activo !== undefined && row.activo !== null) {
        changes.push({ field: "activo", before: current.activo, after: row.activo, same: Boolean(current.activo) === Boolean(row.activo) });
      }
      if (row.precio_oferta !== undefined) {
        changes.push({ field: "precio_oferta", before: current.precio_oferta, after: row.precio_oferta, same: sameNumber(current.precio_oferta, row.precio_oferta) });
      }
      if (row.oferta_hasta !== undefined) {
        changes.push({ field: "oferta_hasta", before: current.oferta_hasta, after: row.oferta_hasta, same: String(current.oferta_hasta ?? "") === String(row.oferta_hasta ?? "") });
      }

      const filteredChanges = changes.filter((change) => !change.same).map(({ same, ...change }) => change);

      if (filteredChanges.length) updated.push({ row, current, changes: filteredChanges });
      else unchanged++;
    }

    return { created, updated, unchanged };
  });

export const adminFetchErpCompareData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const allRows: Array<{ sku: string; nombre: string | null; codigo_fabricante: string | null; precio_vta_sin_iva: number | null; precio: number | null; categoria: string | null; grupo: string | null; stock: number | null; descripcion: string | null; activo: boolean | null; precio_oferta: number | null; oferta_hasta: string | null }> = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await context.supabase
        .from("productos")
        .select("sku, nombre, codigo_fabricante, precio_vta_sin_iva, precio, categoria, grupo, stock, descripcion, activo, precio_oferta, oferta_hasta")
        .not("sku", "is", null)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      allRows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return allRows;
  });

export const adminExportProductos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    q: z.string().max(100).optional().nullable(),
    cat: z.string().max(100).optional().nullable(),
    grupo: z.string().max(100).optional().nullable(),
    activo: z.enum(["all", "yes", "no"]).optional(),
    ids: z.array(z.number().int()).optional().nullable(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("productos")
      .select("id, sku, nombre, codigo_fabricante, precio_vta_sin_iva, precio, stock, categoria, grupo, activo, descripcion, precio_oferta, oferta_hasta, image_url, image_webp")
      .order("id", { ascending: false });

    if (data.ids && data.ids.length > 0) {
      q = q.in("id", data.ids);
    } else {
      if (data.q) {
        const term = data.q.replace(/[%_,]/g, "\\$&");
        q = q.or(`nombre.ilike.%${term}%,sku.ilike.%${term}%,codigo_fabricante.ilike.%${term}%`);
      }
      if (data.cat) q = q.eq("categoria", data.cat);
      if (data.grupo) q = q.eq("grupo", data.grupo);
      if (data.activo === "yes") q = q.eq("activo", true);
      if (data.activo === "no") q = q.eq("activo", false);
    }

    const allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: rows, error } = await q.range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      allRows.push(...(rows ?? []));
      if (!rows || rows.length < pageSize) break;
      from += pageSize;
    }
    return allRows;
  });

// === PRODUCT IMAGES (galería) ===

export const adminListProductImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ producto_id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("product_images")
      .select("*")
      .eq("producto_id", data.producto_id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminAddProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    producto_id: z.number().int(),
    url: z.string().max(500).nullable().optional(),
    url_webp: z.string().max(500).nullable().optional(),
    alt: z.string().max(255).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: max } = await context.supabase
      .from("product_images")
      .select("orden")
      .eq("producto_id", data.producto_id)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (max?.orden ?? -1) + 1;
    const { data: inserted, error } = await context.supabase
      .from("product_images")
      .insert({
        producto_id: data.producto_id,
        url: data.url ?? null,
        url_webp: data.url_webp ?? null,
        alt: data.alt ?? null,
        orden: nextOrden,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const adminReorderProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    producto_id: z.number().int(),
    items: z.array(z.object({ id: z.string().uuid(), orden: z.number().int().min(0).max(1000) })).max(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("product_images")
        .update({ orden: it.orden })
        .eq("id", it.id)
        .eq("producto_id", data.producto_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

function extractStorageKey(url: string | null | undefined, bucket = "product-images"): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

export const adminDeleteProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    // Leer la fila para conocer los archivos del bucket asociados.
    const { data: row } = await context.supabase
      .from("product_images")
      .select("url, url_webp")
      .eq("id", data.id)
      .maybeSingle();
    const keys = [extractStorageKey(row?.url), extractStorageKey(row?.url_webp)].filter(Boolean) as string[];
    if (keys.length) {
      // Best-effort: si falla la limpieza del storage, igual borramos el registro.
      await context.supabase.storage.from("product-images").remove(keys).catch(() => {});
    }
    const { error } = await context.supabase.from("product_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("categorias")
      .select("nombre")
      .eq("activo", true)
      .order("orden", { ascending: true, nullsFirst: false })
      .order("nombre", { ascending: true });

    if (!error) return uniqueSortedCategories((data ?? []).map((c: any) => c.nombre));

    console.warn("[admin] categorias table unavailable, falling back to productos", error.message);
    const fallback = await context.supabase
      .from("productos")
      .select("categoria")
      .not("categoria", "is", null)
      .order("categoria")
      .limit(10000);
    if (fallback.error) throw new Error(fallback.error.message);
    return uniqueSortedCategories(fallback.data?.map((p: any) => p.categoria) ?? []);
  });

export const adminListGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const allGrupos: string[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await context.supabase
        .from("productos")
        .select("grupo")
        .not("grupo", "is", null)
        .not("grupo", "eq", "")
        .order("grupo")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      allGrupos.push(...(data ?? []).map((p: any) => p.grupo));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return [...new Set(allGrupos.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  });

export const adminListUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: profiles, error } = await context.supabase
      .from("profiles").select("id, nombre, telefono, dni, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = await context.supabase
      .from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? ["user"] }));
  });

export const adminToggleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    make_admin: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.make_admin) {
      const { error } = await context.supabase.from("user_roles").insert({ user_id: data.user_id, role: "admin" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [{ data: pedidos }, { count: prodCount }, { data: lowStock }] = await Promise.all([
      context.supabase.from("pedidos").select("id, total, estado, created_at").gte("created_at", since.toISOString()),
      context.supabase.from("productos").select("id", { count: "exact", head: true }),
      context.supabase.from("productos").select("id, nombre, stock").lte("stock", 5).gt("stock", 0).limit(20),
    ]);
    const ventasMes = (pedidos ?? []).filter((p) => p.estado !== "cancelado").reduce((a, b) => a + Number(b.total), 0);
    const pedidosMes = (pedidos ?? []).length;
    const pendientes = (pedidos ?? []).filter((p) => p.estado === "pendiente").length;
    return {
      ventasMes, pedidosMes, pendientes,
      productosTotal: prodCount ?? 0,
      lowStock: lowStock ?? [],
    };
  });
