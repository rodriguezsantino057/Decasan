import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { TrendingUp, ShoppingBag, Clock, Package, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const fn = useServerFn(adminMetrics);
  const { data } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn() });

  if (!data) return <p className="text-sm text-muted-foreground">Cargando métricas...</p>;

  const cards = [
    { label: "Ventas (30 días)", value: formatARS(data.ventasMes), icon: TrendingUp, color: "text-success" },
    { label: "Pedidos del mes", value: data.pedidosMes, icon: ShoppingBag, color: "text-info" },
    { label: "Pendientes de pago", value: data.pendientes, icon: Clock, color: "text-warning" },
    { label: "Productos activos", value: data.productosTotal, icon: Package, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-border bg-surface-elevated p-4 sm:p-5">
            <c.icon className={`size-5 ${c.color}`} />
            <div className="mt-3 text-2xl font-display">{c.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="border border-border">
        <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" />
          <h2 className="font-display text-sm tracking-wide">Stock bajo (≤ 5 unidades)</h2>
        </div>
        {data.lowStock.length === 0 ? (
          <p className="p-4 sm:p-5 text-sm text-muted-foreground">Sin productos con stock bajo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.lowStock.map((p) => (
              <li key={p.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">{p.nombre}</span>
                <span className="font-medium text-warning">{p.stock} u.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
