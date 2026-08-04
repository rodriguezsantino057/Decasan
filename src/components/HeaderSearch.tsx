import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Loader2, X } from "lucide-react";
import { fetchProductos, type Producto } from "@/lib/products";
import { formatARS } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

export function HeaderSearch({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const { items } = await fetchProductos({ q: term, limit: 8 });
        setItems(items);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit() {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    navigate({ to: "/productos", search: { q: term } as never });
  }

  return (
    <div ref={wrapRef} className={`relative ${compact ? "w-full max-w-[280px]" : "w-full max-w-md"}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar herramientas, marcas, SKU..."
          className="w-full bg-background border border-border pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-primary rounded-sm"
          aria-label="Buscar productos"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setItems([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </form>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-popover border border-border shadow-lg max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Buscando...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              Sin resultados para "{q}"
            </div>
          )}
          {items.map((p) => (
            <Link
              key={p.id}
              to="/productos/$id"
              params={{ id: String(p.id) }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-accent border-b border-border last:border-0"
            >
              <div className="size-12 shrink-0 bg-muted overflow-hidden">
                <ProductImage
                  webp={p.image_webp}
                  src={p.image_url}
                  alt={p.nombre ?? ""}
                  className="size-full"
                  iconClassName="size-6"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.nombre}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {p.categoria}
                  {p.grupo ? ` · ${p.grupo}` : ""}
                </div>
              </div>
              <div className="font-display text-sm shrink-0">{formatARS(p.precio)}</div>
            </Link>
          ))}
          {items.length > 0 && (
            <button
              onClick={submit}
              className="block w-full text-center px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90"
            >
              Ver todos los resultados
            </button>
          )}
        </div>
      )}
    </div>
  );
}
