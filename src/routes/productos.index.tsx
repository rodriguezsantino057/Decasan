import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { fetchProductos, fetchCategorias, fetchGrupos, type SortKey } from "@/lib/products";

type SearchParams = {
  q?: string;
  cat?: string;
  grupo?: string;
  min?: number;
  max?: number;
  sort?: SortKey;
  page?: number;
};

const SORTS: { v: SortKey; label: string }[] = [
  { v: "relevance", label: "Relevancia" },
  { v: "price-asc", label: "Precio: menor a mayor" },
  { v: "price-desc", label: "Precio: mayor a menor" },
  { v: "name-asc", label: "Nombre A-Z" },
];

export const Route = createFileRoute("/productos/")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    grupo: typeof s.grupo === "string" ? s.grupo : undefined,
    min: typeof s.min === "number" ? s.min : s.min ? Number(s.min) || undefined : undefined,
    max: typeof s.max === "number" ? s.max : s.max ? Number(s.max) || undefined : undefined,
    sort: (["relevance", "price-asc", "price-desc", "name-asc"] as const).includes(s.sort as SortKey)
      ? (s.sort as SortKey)
      : undefined,
    page: typeof s.page === "number" ? s.page : s.page ? Number(s.page) || undefined : undefined,
  }),
  component: Catalog,
});

const PAGE_SIZE = 24;

function Catalog() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [qLocal, setQLocal] = useState(search.q ?? "");
  const [minLocal, setMinLocal] = useState(search.min?.toString() ?? "");
  const [maxLocal, setMaxLocal] = useState(search.max?.toString() ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const page = search.page ?? 1;
  const sort = search.sort ?? "relevance";

  // Live search debounce
  useEffect(() => {
    const id = setTimeout(() => {
      if ((qLocal || "") !== (search.q ?? "")) {
        navigate({ search: { ...search, q: qLocal || undefined, page: 1 } });
      }
    }, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  useEffect(() => {
    setQLocal(search.q ?? "");
  }, [search.q]);

  const cats = useQuery({ queryKey: ["cats"], queryFn: fetchCategorias });
  const grupos = useQuery({ queryKey: ["grupos"], queryFn: fetchGrupos });

  const products = useQuery({
    queryKey: ["products", search.q, search.cat, search.grupo, search.min, search.max, sort, page],
    queryFn: () =>
      fetchProductos({
        q: search.q,
        cat: search.cat,
        grupo: search.grupo,
        min: search.min,
        max: search.max,
        sort,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  });

  const totalPages = Math.max(1, Math.ceil((products.data?.count ?? 0) / PAGE_SIZE));

  function applyPrice() {
    const min = minLocal ? Number(minLocal) : undefined;
    const max = maxLocal ? Number(maxLocal) : undefined;
    navigate({ search: { ...search, min, max, page: 1 } });
  }

  function reset() {
    setQLocal("");
    setMinLocal("");
    setMaxLocal("");
    navigate({ search: {} });
  }

  const hasFilters = !!(search.q || search.cat || search.grupo || search.min || search.max || search.sort);

  return (
    <Layout>
      <div className="bg-secondary text-secondary-foreground">
        <div className="container-x py-10">
          <div className="text-xs uppercase tracking-[0.25em] text-primary mb-2 animate-fade-in-down">Catálogo</div>
          <h1 className="font-display text-3xl md:text-5xl animate-fade-in-up animate-delay-100">{search.cat ?? "Todos los productos"}</h1>
          <p className="text-secondary-foreground/70 mt-2 text-sm animate-fade-in-up animate-delay-200">
            {products.data?.count ?? "—"} productos
          </p>
        </div>
      </div>

      <div className="container-x py-8 grid lg:grid-cols-[260px_1fr] gap-8">
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="lg:hidden inline-flex items-center justify-center gap-2 border border-border px-4 py-2 text-sm font-medium animate-fade-in-up animate-delay-300"
        >
          <SlidersHorizontal className="size-4" />
          {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
        </button>

        {/* sidebar */}
        <aside className={`space-y-6 ${showFilters ? "block" : "hidden lg:block"} animate-fade-in-left animate-delay-400`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              placeholder="Buscar producto, SKU…"
              className="w-full bg-card border border-input pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <h3 className="font-display text-sm mb-3 uppercase tracking-wider text-muted-foreground">Ordenar</h3>
            <select
              value={sort}
              onChange={(e) =>
                navigate({ search: { ...search, sort: e.target.value as SortKey, page: 1 } })
              }
              className="w-full bg-card border border-input px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="font-display text-sm mb-3 uppercase tracking-wider text-muted-foreground">Precio (ARS)</h3>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={minLocal}
                onChange={(e) => setMinLocal(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                className="w-full bg-card border border-input px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={maxLocal}
                onChange={(e) => setMaxLocal(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                className="w-full bg-card border border-input px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm mb-3 uppercase tracking-wider text-muted-foreground">Categorías</h3>
            <ul className="space-y-1 text-sm max-h-64 overflow-y-auto pr-1">
              <li>
                <button
                  onClick={() => navigate({ search: { ...search, cat: undefined, page: 1 } })}
                  className={`block w-full text-left py-1 hover:text-primary ${!search.cat ? "text-primary font-medium" : ""}`}
                >
                  Todas
                </button>
              </li>
              {(cats.data ?? []).map((c) => (
                <li key={c}>
                  <button
                    onClick={() => navigate({ search: { ...search, cat: c, page: 1 } })}
                    className={`block w-full text-left py-1 hover:text-primary ${search.cat === c ? "text-primary font-medium" : ""}`}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm mb-3 uppercase tracking-wider text-muted-foreground">Grupos</h3>
            <ul className="space-y-1 text-sm max-h-64 overflow-y-auto pr-1">
              <li>
                <button
                  onClick={() => navigate({ search: { ...search, grupo: undefined, page: 1 } })}
                  className={`block w-full text-left py-1 hover:text-primary ${!search.grupo ? "text-primary font-medium" : ""}`}
                >
                  Todas
                </button>
              </li>
              {(grupos.data ?? []).map((g) => (
                <li key={g}>
                  <button
                    onClick={() => navigate({ search: { ...search, grupo: g, page: 1 } })}
                    className={`block w-full text-left py-1 hover:text-primary ${search.grupo === g ? "text-primary font-medium" : ""}`}
                  >
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Limpiar filtros
            </button>
          )}
        </aside>

        {/* grid */}
        <div>
          {products.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`aspect-[3/4] bg-muted animate-pulse animate-fade-in animate-delay-${i * 100}`} />
              ))}
            </div>
          ) : products.data?.items.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border animate-fade-in-up animate-delay-500">
              <p className="text-muted-foreground mb-4">No se encontraron productos con esos filtros.</p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.data?.items.map((p, idx) => (
                  <div key={p.id} className={`animate-fade-in-up animate-delay-${Math.min(idx * 100, 900)}`}>
                    <ProductCard p={p} />
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10 flex-wrap animate-fade-in-up animate-delay-700">
                  {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <Link
                        key={p}
                        to="/productos"
                        search={{ ...search, page: p }}
                        className={`size-9 grid place-items-center text-sm border ${
                          p === page
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                  {totalPages > 8 && <span className="text-muted-foreground">…</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
