import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductImage } from "@/components/ProductImage";
import { useCart } from "@/lib/cart";
import { formatARS } from "@/lib/format";

export const Route = createFileRoute("/carrito")({
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const total = items.reduce((a, b) => a + b.qty * (b.precio || 0), 0);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-x py-20 text-center">
          <ShoppingBag className="size-16 mx-auto text-muted-foreground/40" strokeWidth={1} />
          <h1 className="font-display text-3xl mt-4">Tu carrito está vacío</h1>
          <p className="text-muted-foreground mt-2">Sumá productos desde el catálogo.</p>
          <Link
            to="/productos"
            className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 font-display tracking-wide hover:bg-primary/90"
          >
            Ir al catálogo
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-x py-10">
        <h1 className="font-display text-3xl md:text-4xl mb-6">Carrito</h1>
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="border border-border divide-y divide-border bg-card">
            {items.map((i) => (
              <div key={i.id} className="p-4 flex gap-4 items-center">
                <Link
                  to="/productos/$id"
                  params={{ id: String(i.id) }}
                  className="size-16 bg-muted shrink-0 overflow-hidden border border-border"
                  aria-label={`Ver ${i.nombre}`}
                >
                  <ProductImage
                    webp={i.image_webp}
                    src={i.image_url}
                    alt={i.nombre}
                    className="size-full"
                    iconClassName="size-8"
                    sizes="64px"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/productos/$id"
                    params={{ id: String(i.id) }}
                    className="font-medium text-sm line-clamp-2 hover:text-primary"
                  >
                    {i.nombre}
                  </Link>
                  <div className="text-xs text-muted-foreground">SKU: {i.sku ?? "—"}</div>
                  <div className="font-display text-base mt-1">{formatARS(i.precio)}</div>
                </div>
                <div className="flex items-center border border-border">
                  <button
                    onClick={() => setQty(i.id, i.qty - 1)}
                    className="p-2 hover:bg-muted"
                    aria-label="Restar"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="px-3 text-sm font-medium tabular-nums">{i.qty}</span>
                  <button
                    onClick={() => setQty(i.id, i.qty + 1)}
                    className="p-2 hover:bg-muted"
                    aria-label="Sumar"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <button
                  onClick={() => remove(i.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <aside className="border border-border bg-card p-5 h-fit lg:sticky lg:top-24">
            <h2 className="font-display text-lg mb-4">Resumen</h2>
            <div className="flex justify-between text-sm py-2">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatARS(total)}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Envío</span>
              <span className="text-xs text-muted-foreground">A calcular</span>
            </div>
            <div className="flex justify-between font-display text-xl py-4">
              <span>Total</span>
              <span>{formatARS(total)}</span>
            </div>
            <Link
              to="/checkout"
              className="block text-center bg-primary text-primary-foreground font-display tracking-wide py-3 hover:bg-primary/90"
            >
              Continuar compra
            </Link>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Pago seguro con Mercado Pago · Retiro en local disponible
            </p>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
