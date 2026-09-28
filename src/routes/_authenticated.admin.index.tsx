import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { TrendingUp, Users, Calendar, Trophy, DollarSign, Activity } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboard });

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

function AdminDashboard() {
  const fn = useServerFn(adminMetrics);
  const [mes, setMes] = useState<number | null>(null);
  const [anio, setAnio] = useState<number | null>(null);

  const { data } = useQuery({ 
    queryKey: ["admin-metrics", mes, anio], 
    queryFn: () => fn({ mes, anio }) 
  });

  if (!data) return <p className="text-sm text-muted-foreground">Cargando métricas...</p>;

  const cards = [
    { 
      label: mes || anio ? "Ventas del Periodo" : "Ventas (Últimos 30 días)", 
      value: formatARS(data.ventas), 
      icon: DollarSign, 
      color: "text-success" 
    },
    { 
      label: "Ventas de Hoy", 
      value: formatARS(data.ventasHoy), 
      icon: Calendar, 
      color: "text-primary" 
    },
    { 
      label: "Crecimiento vs. Mes Anterior", 
      value: `${data.crecimientoPct > 0 ? "+" : ""}${data.crecimientoPct.toFixed(1)}%`, 
      icon: TrendingUp, 
      color: data.crecimientoPct >= 0 ? "text-success" : "text-error" 
    },
    { 
      label: "Nuevos Usuarios", 
      value: data.nuevosUsuarios, 
      icon: Users, 
      color: "text-info" 
    },
  ];

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 bg-surface-elevated p-4 border border-border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Mes:</label>
          <select 
            value={mes || ""} 
            onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
            className="border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos (30 días)</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Año:</label>
          <select 
            value={anio || ""} 
            onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : null)}
            className="border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {(mes || anio) && (
          <button 
            onClick={() => { setMes(null); setAnio(null); }}
            className="text-sm text-primary hover:underline ml-2"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

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
          <Trophy className="size-4 text-warning" />
          <h2 className="font-display text-sm tracking-wide">Top 3 Productos Más Vendidos</h2>
        </div>
        {(!data.top3Productos || data.top3Productos.length === 0) ? (
          <p className="p-4 sm:p-5 text-sm text-muted-foreground">No hay datos de ventas en este periodo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.top3Productos.map((p, i) => (
              <li key={p.nombre} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-muted-foreground w-4">{i + 1}.</span>
                  <span className="min-w-0 font-medium">{p.nombre}</span>
                </div>
                <span className="font-medium text-success">{p.cantidad} u.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
