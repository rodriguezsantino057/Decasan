import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, X, Tag, Layers, Power, Percent, Package, BadgePercent, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import {
  adminListProductos, adminUpsertProducto, adminDeleteProducto,
  adminListCategorias, adminListGrupos, adminBulkProductos, adminImportProductosErp, adminPreviewImportProductosErp,
  adminFetchErpCompareData, adminExportProductos,
} from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { ProductGalleryAdmin } from "@/components/ProductGalleryAdmin";
import { parseErpProductFile, type ErpImportRow } from "@/lib/erp-import";

export const Route = createFileRoute("/_authenticated/admin/productos")({ component: AdminProductos });

type ProductoForm = {
  id?: number; nombre: string; descripcion: string; categoria: string; grupo: string;
  sku: string; precio: number; stock: number;
  codigo_fabricante: string; precio_vta_sin_iva: number | null;
  image_url: string; image_webp: string;
  activo: boolean; precio_oferta: number | null; oferta_hasta: string | null;
};
type ProductSortBy = "id" | "nombre" | "precio" | "stock";
type SortDir = "asc" | "desc";

const empty: ProductoForm = {
  nombre: "", descripcion: "", categoria: "", grupo: "", sku: "", precio: 0, stock: 0,
  codigo_fabricante: "", precio_vta_sin_iva: null,
  image_url: "", image_webp: "", activo: true, precio_oferta: null, oferta_hasta: null,
};

function AdminProductos() {
  const qc = useQueryClient();
  const list = useServerFn(adminListProductos);
  const upsert = useServerFn(adminUpsertProducto);
  const del = useServerFn(adminDeleteProducto);
  const bulk = useServerFn(adminBulkProductos);
  const importErp = useServerFn(adminImportProductosErp);
  const previewImportErp = useServerFn(adminPreviewImportProductosErp);
  const fetchErpCompareData = useServerFn(adminFetchErpCompareData);
  const exportProductos = useServerFn(adminExportProductos);
  const listCategorias = useServerFn(adminListCategorias);
  const listGrupos = useServerFn(adminListGrupos);

  const [exporting, setExporting] = useState(false);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState("");
  const [grupo, setGrupo] = useState("");
  const [activo, setActivo] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<ProductSortBy>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<ProductoForm | null>(null);
  // Persistente entre paginación / búsqueda / filtros
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState<null | BulkKind>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-productos", q, page, cat, grupo, activo, sortBy, sortDir],
    queryFn: () => list({ data: { q: q || null, page, cat: cat || null, grupo: grupo || null, activo, sortBy, sortDir } }),
  });

  const { data: categorias } = useQuery({ queryKey: ["admin-categorias"], queryFn: () => listCategorias() });
  const { data: grupos } = useQuery({ queryKey: ["admin-grupos"], queryFn: () => listGrupos() });

  const pageIds = useMemo(() => (data?.rows ?? []).map((p: any) => p.id as number), [data]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: number) => selected.has(id));
  const someOnPageSelected = pageIds.some((id: number) => selected.has(id));

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id: number) => next.delete(id));
      else pageIds.forEach((id: number) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }
  function changeSort(nextSortBy: ProductSortBy) {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(nextSortBy);
      setSortDir(nextSortBy === "nombre" ? "asc" : "desc");
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      toast.info(selected.size > 0 ? `Exportando ${selected.size} productos seleccionados...` : "Exportando productos...");
      
      const payload: any = {};
      if (selected.size > 0) {
        payload.ids = Array.from(selected);
      } else {
        payload.q = q || null;
        payload.cat = cat || null;
        payload.grupo = grupo || null;
        payload.activo = activo;
      }

      const rows = await exportProductos({ data: payload });
      if (!rows || !rows.length) {
        toast.error("No hay productos para exportar");
        return;
      }

      const XLSX = await import("xlsx");
      const formatted = rows.map((r: any) => ({
        ID: r.id,
        SKU: r.sku || "",
        Nombre: r.nombre || "",
        "Cód. Fabricante": r.codigo_fabricante || "",
        "Precio sin IVA": r.precio_vta_sin_iva || 0,
        Precio: r.precio || 0,
        Stock: r.stock || 0,
        Categoría: r.categoria || "",
        Grupo: r.grupo || "",
        Activo: r.activo !== false ? "Sí" : "No",
        Descripción: r.descripcion || "",
        "Precio Oferta": r.precio_oferta || "",
        "Oferta Vence": r.oferta_hasta ? new Date(r.oferta_hasta).toLocaleString() : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
      XLSX.writeFile(workbook, `productos_export_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Productos exportados con éxito");
    } catch (e: any) {
      toast.error(e?.message || "Error al exportar productos");
    } finally {
      setExporting(false);
    }
  }

  async function save(v: ProductoForm) {
    const { image_url: _imageUrl, image_webp: _imageWebp, ...producto } = v;
    const res = await upsert({ data: {
      ...producto,
      descripcion: producto.descripcion || null,
      categoria: producto.categoria || null,
      grupo: producto.grupo || null,
      sku: producto.sku || null,
      precio: Number(producto.precio),
      stock: Number(producto.stock),
      codigo_fabricante: producto.codigo_fabricante || null,
      precio_vta_sin_iva: producto.precio_vta_sin_iva != null ? Number(producto.precio_vta_sin_iva) : null,
      precio_oferta: producto.precio_oferta != null && producto.precio_oferta > 0 ? Number(producto.precio_oferta) : null,
      oferta_hasta: producto.oferta_hasta || null,
    } });
    toast.success("Producto guardado");
    // Si era nuevo, dejamos abierto para subir imágenes
    if (!v.id && res?.id) {
      setEditing({ ...v, id: res.id });
    } else {
      setEditing(null);
    }
    qc.invalidateQueries({ queryKey: ["admin-productos"] });
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar producto?")) return;
    await del({ data: { id } });
    toast.success("Eliminado");
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    qc.invalidateQueries({ queryKey: ["admin-productos"] });
  }

  async function runBulk(payload: any) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      const res = await bulk({ data: { ...payload, ids } });
      toast.success(`${(res as any)?.updated ?? ids.length} productos actualizados`);
      setBulkOpen(null);
      qc.invalidateQueries({ queryKey: ["admin-productos"] });
      qc.invalidateQueries({ queryKey: ["admin-categorias"] });
      qc.invalidateQueries({ queryKey: ["admin-grupos"] });
      if (payload.action === "delete") clearSelection();
    } catch (e: any) {
      toast.error(e?.message ?? "Error en acción masiva");
    }
  }

  async function importRows(rows: ErpImportRow[]) {
    const chunks = chunkRows(rows, IMPORT_CHUNK_SIZE);
    let updated = 0;
    let created = 0;
    for (let i = 0; i < chunks.length; i++) {
      toast.info(`Importando lote ${i + 1} de ${chunks.length}`);
      const chunk = chunks[i];
      const res = await importErp({ data: { rows: chunk } });
      updated += res.updated;
      created += res.created;
    }
    toast.success(`ERP importado: ${updated} actualizados, ${created} nuevos`);
    setImportOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-productos"] });
  }

  return (
    <div className="pb-32">
      <div className="grid gap-2 mb-4 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_180px_180px_170px_auto_auto_auto] lg:items-center">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por nombre, SKU o código fabricante..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-border bg-background outline-none focus:border-primary text-sm"
          />
        </div>
        <SearchSelect
          placeholder="Buscar categoría..."
          options={(categorias as string[]) ?? []}
          value={cat}
          onChange={(c) => { setCat(c); setPage(1); }}
        />
        <SearchSelect
          placeholder="Buscar Grupos..."
          options={(grupos as string[]) ?? []}
          value={grupo}
          onChange={(g) => { setGrupo(g); setPage(1); }}
        />
        <select value={activo} onChange={(e) => { setActivo(e.target.value as any); setPage(1); }} className="w-full border border-border bg-background px-3 py-2 text-sm">
          <option value="all">Activos e inactivos</option>
          <option value="yes">Solo activos</option>
          <option value="no">Solo inactivos</option>
        </select>
        <button onClick={() => setEditing({ ...empty })} className="w-full justify-center bg-primary text-primary-foreground px-4 py-2 text-sm font-medium flex items-center gap-2">
          <Plus className="size-4" /> Nuevo
        </button>
        <button onClick={() => setImportOpen(true)} className="w-full justify-center border border-border px-4 py-2 text-sm font-medium flex items-center gap-2 hover:border-primary">
          <Upload className="size-4" /> Importar ERP
        </button>
        <button 
          onClick={handleExport} 
          disabled={exporting}
          className="w-full justify-center border border-border px-4 py-2 text-sm font-medium flex items-center gap-2 hover:border-primary disabled:opacity-50"
        >
          <Download className="size-4" /> {exporting ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      <div className="hidden border border-border overflow-x-auto lg:block">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                  onChange={togglePage}
                  aria-label="Seleccionar página"
                />
              </th>
              <th className="text-left px-3 py-2 w-12"></th>
              <th className="text-left px-3 py-2">
                <SortHeader label="Nombre" active={sortBy === "nombre"} dir={sortDir} onClick={() => changeSort("nombre")} />
              </th>
              <th className="text-left px-3 py-2 hidden md:table-cell">SKU</th>
              <th className="text-left px-3 py-2 hidden xl:table-cell">Cód. fabricante</th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">Categoría</th>
              <th className="text-left px-3 py-2 hidden xl:table-cell">Grupo</th>
              <th className="text-right px-3 py-2 hidden xl:table-cell">Sin IVA</th>
              <th className="text-right px-3 py-2">
                <SortHeader label="Precio" active={sortBy === "precio"} dir={sortDir} align="right" onClick={() => changeSort("precio")} />
              </th>
              <th className="text-right px-3 py-2">
                <SortHeader label="Stock" active={sortBy === "stock"} dir={sortDir} align="right" onClick={() => changeSort("stock")} />
              </th>
              <th className="px-3 py-2 hidden md:table-cell">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((p: any) => {
              const isSel = selected.has(p.id);
              const enOferta = p.precio_oferta && Number(p.precio_oferta) > 0 && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date());
              return (
                <tr key={p.id} className={`border-t border-border ${isSel ? "bg-accent/30" : ""}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={isSel} onChange={() => toggleOne(p.id)} aria-label={`Seleccionar ${p.nombre}`} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="size-10 bg-muted overflow-hidden">
                      <ProductImage webp={p.image_webp} src={p.image_url} alt={p.nombre ?? ""} className="size-full" iconClassName="size-5" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {p.nombre}
                    {enOferta && <BadgePercent className="inline-block size-3.5 ml-1.5 text-primary" />}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{p.sku}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-muted-foreground">{p.codigo_fabricante || "-"}</td>
                  <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{p.categoria}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-muted-foreground">{p.grupo || "-"}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-right text-muted-foreground">{p.precio_vta_sin_iva != null ? formatARS(Number(p.precio_vta_sin_iva)) : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {enOferta ? (
                      <span>
                        <span className="line-through text-muted-foreground text-xs mr-1">{formatARS(Number(p.precio ?? 0))}</span>
                        {formatARS(Number(p.precio_oferta))}
                      </span>
                    ) : formatARS(Number(p.precio ?? 0))}
                  </td>
                  <td className={`px-3 py-2 text-right ${(p.stock ?? 0) <= 5 ? "text-warning" : ""}`}>{p.stock ?? 0}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-center">
                    {p.activo === false
                      ? <span className="text-[10px] uppercase bg-muted text-muted-foreground px-2 py-0.5">Inactivo</span>
                      : <span className="text-[10px] uppercase bg-success/15 text-success px-2 py-0.5">Activo</span>}
                  </td>
                  <td className="px-3 py-2 flex gap-1 justify-end">
                    <button onClick={() => setEditing({
                      id: p.id, nombre: p.nombre ?? "", descripcion: p.descripcion ?? "", categoria: p.categoria ?? "",
                      grupo: p.grupo ?? "", sku: p.sku ?? "", precio: Number(p.precio ?? 0), stock: p.stock ?? 0,
                      codigo_fabricante: p.codigo_fabricante ?? "", precio_vta_sin_iva: p.precio_vta_sin_iva != null ? Number(p.precio_vta_sin_iva) : null,
                      image_url: p.image_url ?? "", image_webp: p.image_webp ?? "",
                      activo: p.activo !== false,
                      precio_oferta: p.precio_oferta != null ? Number(p.precio_oferta) : null,
                      oferta_hasta: p.oferta_hasta ?? null,
                    })} className="p-1.5 hover:text-primary"><Edit className="size-4" /></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 hover:text-destructive"><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {data?.rows.map((p: any) => {
          const isSel = selected.has(p.id);
          const enOferta = p.precio_oferta && Number(p.precio_oferta) > 0 && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date());
          return (
            <ProductAdminCard
              key={p.id}
              product={p}
              selected={isSel}
              enOferta={Boolean(enOferta)}
              onToggle={() => toggleOne(p.id)}
              onEdit={() => setEditing({
                id: p.id, nombre: p.nombre ?? "", descripcion: p.descripcion ?? "", categoria: p.categoria ?? "",
                grupo: p.grupo ?? "", sku: p.sku ?? "", precio: Number(p.precio ?? 0), stock: p.stock ?? 0,
                codigo_fabricante: p.codigo_fabricante ?? "", precio_vta_sin_iva: p.precio_vta_sin_iva != null ? Number(p.precio_vta_sin_iva) : null,
                image_url: p.image_url ?? "", image_webp: p.image_webp ?? "",
                activo: p.activo !== false,
                precio_oferta: p.precio_oferta != null ? Number(p.precio_oferta) : null,
                oferta_hasta: p.oferta_hasta ?? null,
              })}
              onDelete={() => remove(p.id)}
            />
          );
        })}
      </div>

      {data && data.count > data.pageSize && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mt-4 text-sm">
          <span className="text-muted-foreground">{data.count} productos · {selected.size} seleccionados</span>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-border disabled:opacity-30">Anterior</button>
            <span className="px-3 py-1">Pág {page}</span>
            <button disabled={page * data.pageSize >= data.count} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-border disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-2 bottom-3 z-40 bg-foreground text-background border border-foreground shadow-lg flex items-center gap-1 px-3 py-2 overflow-x-auto sm:inset-x-auto sm:left-1/2 sm:max-w-[95vw] sm:-translate-x-1/2">
          <span className="text-xs font-semibold pr-2 border-r border-background/30 mr-1 whitespace-nowrap">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <BulkBtn icon={<Tag className="size-3.5" />} label="Categoría" onClick={() => setBulkOpen("categoria")} />
          <BulkBtn icon={<Layers className="size-3.5" />} label="Marca" onClick={() => setBulkOpen("grupo")} />
          <BulkBtn icon={<Power className="size-3.5" />} label="Estado" onClick={() => setBulkOpen("activo")} />
          <BulkBtn icon={<Percent className="size-3.5" />} label="Precio %" onClick={() => setBulkOpen("precio")} />
          <BulkBtn icon={<Package className="size-3.5" />} label="Stock" onClick={() => setBulkOpen("stock")} />
          <BulkBtn icon={<BadgePercent className="size-3.5" />} label="Oferta" onClick={() => setBulkOpen("oferta")} />
          <BulkBtn icon={<Trash2 className="size-3.5" />} label="Eliminar" danger onClick={() => setBulkOpen("delete")} />
          <button onClick={clearSelection} className="ml-2 p-1 hover:text-primary" aria-label="Limpiar selección">
            <X className="size-4" />
          </button>
        </div>
      )}

      {bulkOpen && (
        <BulkDialog
          kind={bulkOpen}
          count={selected.size}
          categorias={(categorias as string[]) ?? []}
          grupos={(grupos as string[]) ?? []}
          onClose={() => setBulkOpen(null)}
          onConfirm={runBulk}
        />
      )}

      {editing && <ProductoModal value={editing} categorias={(categorias as string[]) ?? []} grupos={(grupos as string[]) ?? []} onClose={() => setEditing(null)} onSave={save} />}
      {importOpen && (
        <ErpImportModal
          onClose={() => setImportOpen(false)}
          onImport={importRows}
          onPreview={async (rows, onStatus) => {
            onStatus("Descargando catálogo existente para comparar...");
            const existing = await fetchErpCompareData();
            
            onStatus(`Comparando ${rows.length} productos...`);
            const bySku = new Map<string, any>();
            for (const item of existing) {
              if (item.sku) {
                bySku.set(item.sku, item);
              }
            }

            const created: ErpImportRow[] = [];
            const updated: Array<{ row: ErpImportRow; current: any; changes: Array<{ field: string; before: any; after: any }> }> = [];
            let unchanged = 0;

            function sameNumber(a: unknown, b: unknown) {
              if (a == null && b == null) return true;
              const na = Number(a);
              const nb = Number(b);
              return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 0.001;
            }

            for (const row of rows) {
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

              if (filteredChanges.length) {
                updated.push({ row, current, changes: filteredChanges });
              } else {
                unchanged++;
              }
            }

            created.sort((a, b) => compareProductName(a.nombre, b.nombre));
            updated.sort((a, b) => compareProductName(a.row.nombre, b.row.nombre));

            return { created, updated, unchanged };
          }}
        />
      )}
    </div>
  );
}

function BulkBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap hover:bg-background/10 ${danger ? "text-destructive" : ""}`}
    >
      {icon} {label}
    </button>
  );
}

function SortHeader({ label, active, dir, onClick, align = "left" }: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide hover:text-primary ${align === "right" ? "justify-end" : "justify-start"} w-full`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span>{label}</span>
      <Icon className="size-3.5" />
    </button>
  );
}

function ProductAdminCard({ product: p, selected, enOferta, onToggle, onEdit, onDelete }: {
  product: any;
  selected: boolean;
  enOferta: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`border border-border bg-surface-elevated p-3 ${selected ? "ring-1 ring-primary bg-accent/30" : ""}`}>
      <div className="flex gap-3">
        <label className="pt-1">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Seleccionar ${p.nombre}`} />
        </label>
        <div className="size-16 shrink-0 bg-muted overflow-hidden">
          <ProductImage webp={p.image_webp} src={p.image_url} alt={p.nombre ?? ""} className="size-full" iconClassName="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug line-clamp-2">
              {p.nombre}
              {enOferta && <BadgePercent className="inline-block size-3.5 ml-1.5 text-primary" />}
            </h3>
            <span className={`shrink-0 text-[10px] uppercase px-2 py-0.5 ${p.activo === false ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"}`}>
              {p.activo === false ? "Inactivo" : "Activo"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="truncate">{p.sku || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cod. fab.</dt>
              <dd className="truncate">{p.codigo_fabricante || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Precio</dt>
              <dd className="font-medium">{formatARS(Number(enOferta ? p.precio_oferta : p.precio ?? 0))}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stock</dt>
              <dd className={(p.stock ?? 0) <= 5 ? "font-medium text-warning" : "font-medium"}>{p.stock ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
        <button onClick={onEdit} className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">
          <Edit className="size-3.5" /> Editar
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium hover:border-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Eliminar
        </button>
      </div>
    </article>
  );
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

const IMPORT_CHUNK_SIZE = 500;
const IMPORT_PREVIEW_PAGE_SIZE = 50;

type ImportPreview = {
  created: ErpImportRow[];
  updated: Array<{ row: ErpImportRow; changes: Array<{ field: string; before: unknown; after: unknown }> }>;
  unchanged: number;
};

function ErpImportModal({ onClose, onImport, onPreview }: {
  onClose: () => void;
  onImport: (rows: ErpImportRow[]) => Promise<void>;
  onPreview: (rows: ErpImportRow[], onStatus: (status: string) => void) => Promise<ImportPreview>;
}) {
  const [rows, setRows] = useState<ErpImportRow[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [tab, setTab] = useState<"created" | "updated">("created");
  const [createdPage, setCreatedPage] = useState(1);
  const [updatedPage, setUpdatedPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");

  async function loadFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseErpProductFile(file);
      setRows(parsed);
      setFileName(file.name);
      setCreatedPage(1);
      setUpdatedPage(1);
      if (!parsed.length) toast.error("No encontré filas válidas en el Excel.");
      else {
        setPreview(await onPreview(parsed, setStatus));
      }
    } catch (e: any) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function apply() {
    if (!rows.length || !preview) return;
    setBusy(true);
    try {
      const changedSkus = new Set([
        ...preview.created.map((r) => r.sku),
        ...preview.updated.map((u) => u.row.sku),
      ]);
      const filteredRows = rows.filter((r) => changedSkus.has(r.sku));
      if (!filteredRows.length) {
        toast.info("No hay cambios para importar");
        setBusy(false);
        return;
      }
      setStatus(`Importando ${filteredRows.length} productos (${preview.created.length} nuevos, ${preview.updated.length} modificados)...`);
      await onImport(filteredRows);
    } catch (e: any) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center p-2 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background text-foreground border border-border max-w-5xl w-full max-h-[92vh] overflow-auto p-4 sm:p-6">
        <h2 className="font-display text-xl mb-1">Importar productos del ERP</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Actualiza SKU, nombre, código fabricante y precios. No toca categorías, grupos, stock ecommerce, imágenes, descripción, estado ni ofertas.
        </p>
        <label className="block border border-dashed border-border p-6 text-center cursor-pointer hover:border-primary">
          <Upload className="size-5 mx-auto mb-2 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName || "Elegir Excel o CSV"}</span>
          <input type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0] ?? null)} />
        </label>

        {preview && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
              <div className="border border-border px-3 py-2 text-foreground"><strong>{preview.created.length}</strong> nuevos</div>
              <div className="border border-border px-3 py-2 text-foreground"><strong>{preview.updated.length}</strong> modificados</div>
              <div className="border border-border px-3 py-2 text-muted-foreground"><strong>{preview.unchanged}</strong> sin cambios</div>
            </div>
            <div className="flex gap-2 mb-2 text-sm">
              <button onClick={() => setTab("created")} className={`px-3 py-1.5 border ${tab === "created" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>Nuevos</button>
              <button onClick={() => setTab("updated")} className={`px-3 py-1.5 border ${tab === "updated" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>Modificados</button>
            </div>
            {tab === "created" ? (
              <>
                <CreatedRowsTable rows={paginateRows(preview.created, createdPage)} />
                <ImportPagination total={preview.created.length} page={createdPage} onPageChange={setCreatedPage} />
              </>
            ) : (
              <>
                <UpdatedRowsTable rows={paginateRows(preview.updated, updatedPage)} />
                <ImportPagination total={preview.updated.length} page={updatedPage} onPageChange={setUpdatedPage} />
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-5">
          <span className="text-xs text-muted-foreground">{status || (preview ? `${preview.created.length + preview.updated.length} productos para importar (${preview.unchanged} sin cambios se omiten)` : rows.length ? `${rows.length} filas leídas` : "Esperando archivo")}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
            <button disabled={busy || rows.length === 0} onClick={apply} className="bg-primary text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? "Procesando..." : "Aplicar importación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function compareProductName(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

function formatError(error: any) {
  if (typeof error?.message === "string" && error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "No pude procesar el archivo.";
  }
}

function CreatedRowsTable({ rows }: { rows: ErpImportRow[] }) {
  if (!rows.length) return <div className="border border-border p-6 text-sm text-muted-foreground">No hay productos nuevos en este archivo.</div>;

  const hasCategoria = rows.some((r) => r.categoria !== undefined);
  const hasGrupo = rows.some((r) => r.grupo !== undefined);
  const hasStock = rows.some((r) => r.stock !== undefined && r.stock !== null);
  const hasDescripcion = rows.some((r) => r.descripcion !== undefined);
  const hasActivo = rows.some((r) => r.activo !== undefined && r.activo !== null);
  const hasOferta = rows.some((r) => r.precio_oferta !== undefined);

  return (
    <div className="border border-border max-h-72 overflow-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="bg-secondary text-secondary-foreground sticky top-0">
          <tr>
            <th className="text-left px-3 py-2">SKU</th>
            <th className="text-left px-3 py-2">Nombre</th>
            <th className="text-left px-3 py-2">Cód. fabricante</th>
            <th className="text-right px-3 py-2">Sin IVA</th>
            <th className="text-right px-3 py-2">Venta</th>
            {hasCategoria && <th className="text-left px-3 py-2">Categoría</th>}
            {hasGrupo && <th className="text-left px-3 py-2">Grupo</th>}
            {hasStock && <th className="text-right px-3 py-2">Stock</th>}
            {hasActivo && <th className="text-center px-3 py-2">Estado</th>}
            {hasOferta && <th className="text-right px-3 py-2">Oferta</th>}
            {hasDescripcion && <th className="text-left px-3 py-2">Descripción</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row) => (
            <tr key={row.sku} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.sku}</td>
              <td className="px-3 py-2">{row.nombre}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.codigo_fabricante ?? "-"}</td>
              <td className="px-3 py-2 text-right">{row.precio_vta_sin_iva != null ? formatARS(row.precio_vta_sin_iva) : "-"}</td>
              <td className="px-3 py-2 text-right">{formatARS(row.precio)}</td>
              {hasCategoria && <td className="px-3 py-2">{row.categoria ?? "-"}</td>}
              {hasGrupo && <td className="px-3 py-2">{row.grupo ?? "-"}</td>}
              {hasStock && <td className="px-3 py-2 text-right">{row.stock ?? "-"}</td>}
              {hasActivo && <td className="px-3 py-2 text-center">{row.activo == null ? "-" : row.activo ? "Activo" : "Inactivo"}</td>}
              {hasOferta && <td className="px-3 py-2 text-right">{row.precio_oferta != null ? formatARS(row.precio_oferta) : "-"}</td>}
              {hasDescripcion && <td className="px-3 py-2 max-w-[200px] truncate">{row.descripcion ?? "-"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UpdatedRowsTable({ rows }: { rows: Array<{ row: ErpImportRow; changes: Array<{ field: string; before: unknown; after: unknown }> }> }) {
  if (!rows.length) return <div className="border border-border p-6 text-sm text-muted-foreground">No hay productos modificados en este archivo.</div>;
  return (
    <div className="border border-border max-h-72 overflow-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="bg-secondary text-secondary-foreground sticky top-0">
          <tr>
            <th className="text-left px-3 py-2">SKU</th>
            <th className="text-left px-3 py-2">Producto</th>
            <th className="text-left px-3 py-2">Cambios detectados</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map(({ row, changes }) => (
            <tr key={row.sku} className="border-t border-border align-top">
              <td className="px-3 py-2 font-medium">{row.sku}</td>
              <td className="px-3 py-2">{row.nombre}</td>
              <td className="px-3 py-2">
                <div className="space-y-1">
                  {changes.map((change) => (
                    <div key={change.field} className="grid grid-cols-[130px_1fr] gap-2">
                      <span className="text-muted-foreground">{fieldLabel(change.field)}</span>
                      <span>
                        <span className="line-through text-muted-foreground">{formatImportValue(change.field, change.before)}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{formatImportValue(change.field, change.after)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function paginateRows<T>(rows: T[], page: number) {
  const start = (page - 1) * IMPORT_PREVIEW_PAGE_SIZE;
  return rows.slice(start, start + IMPORT_PREVIEW_PAGE_SIZE);
}

function ImportPagination({ total, page, onPageChange }: { total: number; page: number; onPageChange: (page: number) => void }) {
  if (total <= IMPORT_PREVIEW_PAGE_SIZE) return null;
  const totalPages = Math.max(1, Math.ceil(total / IMPORT_PREVIEW_PAGE_SIZE));
  const start = (page - 1) * IMPORT_PREVIEW_PAGE_SIZE + 1;
  const end = Math.min(total, page * IMPORT_PREVIEW_PAGE_SIZE);

  return (
    <div className="flex items-center justify-between gap-3 mt-2 text-xs text-muted-foreground">
      <span>{start}-{end} de {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="border border-border px-3 py-1 text-foreground disabled:opacity-40">
          Anterior
        </button>
        <span>Pag {page} de {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="border border-border px-3 py-1 text-foreground disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  );
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    nombre: "Nombre",
    codigo_fabricante: "Cód. fabricante",
    precio_vta_sin_iva: "Precio sin IVA",
    precio: "Precio venta",
    categoria: "Categoría",
    grupo: "Grupo",
    stock: "Stock",
    descripcion: "Descripción",
    activo: "Estado",
    precio_oferta: "Precio oferta",
    oferta_hasta: "Oferta hasta",
  };
  return labels[field] ?? field;
}

function formatImportValue(field: string, value: unknown) {
  if (value == null || value === "") return "-";
  if (field === "precio" || field === "precio_vta_sin_iva" || field === "precio_oferta") return formatARS(Number(value));
  if (field === "activo") return value ? "Activo" : "Inactivo";
  if (field === "stock") return String(Number(value));
  return String(value);
}

// === BULK DIALOG ===

type BulkKind = "categoria" | "grupo" | "activo" | "precio" | "stock" | "oferta" | "delete";

function BulkDialog({ kind, count, categorias, grupos, onClose, onConfirm }: {
  kind: BulkKind; count: number;
  categorias: string[]; grupos: string[];
  onClose: () => void;
  onConfirm: (payload: any) => Promise<void>;
}) {
  const [categoria, setCategoria] = useState("");
  const [grupo, setGrupo] = useState("");
  const [activo, setActivo] = useState(true);
  const [pct, setPct] = useState(0);
  const [stock, setStock] = useState(0);
  const [precioOferta, setPrecioOferta] = useState<number | "">("");
  const [ofertaHasta, setOfertaHasta] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(kind === "delete" || kind === "precio");
  const [acked, setAcked] = useState(false);

  const titles: Record<BulkKind, string> = {
    categoria: "Cambiar categoría", grupo: "Cambiar marca / grupo", activo: "Activar / desactivar",
    precio: "Ajuste de precio por porcentaje", stock: "Establecer stock",
    oferta: "Crear / quitar oferta", delete: "Eliminar productos",
  };

  async function go() {
    setBusy(true);
    try {
      let payload: any = null;
      switch (kind) {
        case "categoria": payload = { action: "set_categoria", categoria: categoria || null }; break;
        case "grupo": payload = { action: "set_grupo", grupo: grupo || null }; break;
        case "activo": payload = { action: "set_activo", activo }; break;
        case "precio":
          if (!isFinite(pct) || pct === 0) { toast.error("Ingresá un porcentaje distinto de 0"); setBusy(false); return; }
          payload = { action: "adjust_precio_pct", pct }; break;
        case "stock": payload = { action: "set_stock", stock }; break;
        case "oferta":
          payload = {
            action: "set_oferta",
            precio_oferta: precioOferta === "" ? null : Number(precioOferta),
            oferta_hasta: ofertaHasta ? new Date(ofertaHasta).toISOString() : null,
          };
          break;
        case "delete": payload = { action: "delete" }; break;
      }
      await onConfirm(payload);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center p-2 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border max-w-md w-full max-h-[92vh] overflow-auto p-4 sm:p-6">
        <h3 className="font-display text-lg mb-1">{titles[kind]}</h3>
        <p className="text-xs text-muted-foreground mb-4">Se aplicará a <strong>{count}</strong> producto{count === 1 ? "" : "s"} seleccionado{count === 1 ? "" : "s"}.</p>

        {kind === "categoria" && (
          <label className="block mb-4">
            <span className="text-xs uppercase font-medium text-muted-foreground">Nueva categoría</span>
            <input list="cats-bulk" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" placeholder="Dejar vacío para limpiar" />
            <datalist id="cats-bulk">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        )}
        {kind === "grupo" && (
          <label className="block mb-4">
            <span className="text-xs uppercase font-medium text-muted-foreground">Nueva marca / grupo</span>
            <input list="grupos-bulk" value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" placeholder="Dejar vacío para limpiar" />
            <datalist id="grupos-bulk">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
          </label>
        )}
        {kind === "activo" && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setActivo(true)} className={`border px-3 py-2 text-sm ${activo ? "border-success bg-success/10 text-success" : "border-border"}`}>Activar</button>
            <button type="button" onClick={() => setActivo(false)} className={`border px-3 py-2 text-sm ${!activo ? "border-foreground bg-muted" : "border-border"}`}>Desactivar</button>
          </div>
        )}
        {kind === "precio" && (
          <>
            <label className="block mb-2">
              <span className="text-xs uppercase font-medium text-muted-foreground">Porcentaje (+ o −)</span>
              <input type="number" step="0.1" min={-90} max={500} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-muted-foreground mb-4">Ej: <code>10</code> aumenta 10%, <code>-15</code> rebaja 15%. Productos con precio 0 se omiten.</p>
          </>
        )}
        {kind === "stock" && (
          <label className="block mb-4">
            <span className="text-xs uppercase font-medium text-muted-foreground">Stock (absoluto)</span>
            <input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" />
          </label>
        )}
        {kind === "oferta" && (
          <>
            <label className="block mb-3">
              <span className="text-xs uppercase font-medium text-muted-foreground">Precio de oferta (vacío = quitar oferta)</span>
              <input type="number" min={0} step="0.01" value={precioOferta} onChange={(e) => setPrecioOferta(e.target.value === "" ? "" : Number(e.target.value))} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block mb-4">
              <span className="text-xs uppercase font-medium text-muted-foreground">Vence el (opcional)</span>
              <input type="datetime-local" value={ofertaHasta} onChange={(e) => setOfertaHasta(e.target.value)} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </>
        )}
        {kind === "delete" && (
          <div className="mb-4 p-3 border border-destructive/50 bg-destructive/10 text-sm">
            Esta acción <strong>elimina</strong> {count} productos y no se puede deshacer.
          </div>
        )}

        {(kind === "delete" || kind === "precio") && (
          <label className="flex items-start gap-2 mb-4 text-xs">
            <input type="checkbox" checked={acked} onChange={(e) => { setAcked(e.target.checked); setConfirm(e.target.checked); }} className="mt-0.5" />
            <span>Confirmo aplicar este cambio a {count} producto{count === 1 ? "" : "s"}.</span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={go}
            disabled={busy || ((kind === "delete" || kind === "precio") && !confirm)}
            className={`px-4 py-2 text-sm font-medium ${kind === "delete" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
          >
            {busy ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === EDIT MODAL ===

function ProductoModal({ value, categorias, grupos, onClose, onSave }: {
  value: ProductoForm; categorias: string[]; grupos: string[];
  onClose: () => void; onSave: (v: ProductoForm) => Promise<void>;
}) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"info" | "galeria" | "oferta">("info");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center p-2 sm:p-4 overflow-auto" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(v); } finally { setBusy(false); } }}
        className="bg-background border border-border max-w-3xl w-full max-h-[92vh] overflow-auto p-4 sm:p-6 sm:my-8"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl">{v.id ? "Editar producto" : "Nuevo producto"}</h2>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} />
            {v.activo ? "Activo (visible en catálogo)" : "Inactivo (oculto al público)"}
          </label>
        </div>

        <div className="flex gap-4 border-b border-border mt-3 mb-4 text-sm">
          {(["info", "galeria", "oferta"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2 -mb-px border-b-2 capitalize ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "info" ? "Información" : t === "galeria" ? "Galería" : "Oferta"}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2" value={v.nombre} onChange={(x) => setV({ ...v, nombre: x })} required />
            <Field label="SKU" value={v.sku} onChange={(x) => setV({ ...v, sku: x })} />
            <Field label="Código fabricante" value={v.codigo_fabricante} onChange={(x) => setV({ ...v, codigo_fabricante: x })} />
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoría</span>
              <input list="cats-edit" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <datalist id="cats-edit">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marca / Grupo</span>
              <input list="grupos-edit" value={v.grupo} onChange={(e) => setV({ ...v, grupo: e.target.value })} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <datalist id="grupos-edit">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <Field label="Precio (ARS)" type="number" value={String(v.precio)} onChange={(x) => setV({ ...v, precio: Number(x) })} required />
            <Field label="Precio sin IVA" type="number" value={v.precio_vta_sin_iva != null ? String(v.precio_vta_sin_iva) : ""} onChange={(x) => setV({ ...v, precio_vta_sin_iva: x === "" ? null : Number(x) })} />
            <Field label="Stock" type="number" value={String(v.stock)} onChange={(x) => setV({ ...v, stock: Number(x) })} required />
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</span>
              <textarea value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} rows={4} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
          </div>
        )}

        {tab === "galeria" && (
          v.id
            ? <ProductGalleryAdmin productoId={v.id} />
            : <div className="text-sm text-muted-foreground p-6 border border-dashed border-border text-center">
                Guardá primero el producto y volvé a esta pestaña para subir imágenes.
              </div>
        )}

        {tab === "oferta" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Precio de oferta"
              type="number"
              value={v.precio_oferta != null ? String(v.precio_oferta) : ""}
              onChange={(x) => setV({ ...v, precio_oferta: x === "" ? null : Number(x) })}
            />
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vence el</span>
              <input
                type="datetime-local"
                value={v.oferta_hasta ? new Date(v.oferta_hasta).toISOString().slice(0, 16) : ""}
                onChange={(e) => setV({ ...v, oferta_hasta: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <p className="sm:col-span-2 text-xs text-muted-foreground">Dejá ambos vacíos para quitar la oferta. Si no ponés fecha, la oferta queda activa indefinidamente.</p>
          </div>
        )}

        <div className="flex gap-2 mt-6 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">Cerrar</button>
          <button disabled={busy} type="submit" className="bg-primary text-primary-foreground px-5 py-2 text-sm font-medium">{busy ? "..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, type, className }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function SearchSelect({ placeholder, options, value, onChange }: { placeholder: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click — same reliable pattern as HeaderSearch
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option: string) => {
    onChange(option === value ? "" : option);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={value ? `✓ ${value}` : placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-8 py-2 border border-border bg-background text-sm outline-none focus:border-primary"
        />
        {value ? (
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar filtro"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className={`size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>
      {open && options && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {!search && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(""); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${!value ? "bg-primary/10 text-primary font-medium" : ""}`}
            >
              {!value && <span className="mr-2">✓</span>}
              Todas
            </button>
          )}
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${value === option ? "bg-primary/10 text-primary font-medium" : ""}`}
              >
                {value === option && <span className="mr-2">✓</span>}
                {option}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">No encontradas</div>
          )}
        </div>
      )}
    </div>
  );
}
