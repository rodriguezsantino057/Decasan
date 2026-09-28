import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { TrendingUp, Users, Calendar, Trophy, DollarSign, Activity, Filter, X } from "lucide-react";
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
    queryFn: () => fn({ data: { mes, anio } }) 
  });

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground animate-pulse">
      <Activity className="size-8 mb-4 animate-spin" />
      <p>Cargando métricas...</p>
    </div>
  );

  const cards = [
    { 
      label: mes || anio ? "Ventas del Periodo" : "Ventas (Últimos 30 días)", 
      value: formatARS(data.ventas), 
      icon: DollarSign, 
      color: "text-success",
      bgIcon: "bg-success/10"
    },
    { 
      label: "Ventas de Hoy", 
      value: formatARS(data.ventasHoy), 
      icon: Calendar, 
      color: "text-primary",
      bgIcon: "bg-primary/10"
    },
    { 
      label: "Crecimiento vs. Anterior", 
      value: `${data.crecimientoPct > 0 ? "+" : ""}${data.crecimientoPct.toFixed(1)}%`, 
      icon: TrendingUp, 
      color: data.crecimientoPct >= 0 ? "text-success" : "text-error",
      bgIcon: data.crecimientoPct >= 0 ? "bg-success/10" : "bg-error/10"
    },
    { 
      label: "Nuevos Usuarios", 
      value: data.nuevosUsuarios, 
      icon: Users, 
      color: "text-info",
      bgIcon: "bg-info/10"
    },
  ];

  // Ya asumiendo que vienen 103 items como máximo
  const topProductos = (data as any).topProductos ?? (data as any).top3Productos ?? [];
  const top3 = topProductos.slice(0, 3);
  const restTop = topProductos.slice(3, 103);

  return (
    <div className="space-y-6 pb-12">
      {/* Filtros dinámicos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-elevated p-5 border border-border shadow-sm rounded-lg transition-all hover:shadow-md">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Filter className="size-5" />
          <span>Filtros de Periodo</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={mes || ""} 
            onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
            className="border border-border bg-background px-3 py-2 text-sm rounded-md focus:border-primary outline-none transition-colors cursor-pointer"
          >
            <option value="">Mes (Últimos 30 días)</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select 
            value={anio || ""} 
            onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : null)}
            className="border border-border bg-background px-3 py-2 text-sm rounded-md focus:border-primary outline-none transition-colors cursor-pointer"
          >
            <option value="">Año Actual</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {(mes || anio) && (
            <button 
              onClick={() => { setMes(null); setAnio(null); }}
              className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors"
              title="Limpiar filtros"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid Dinámica de Tarjetas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div 
            key={c.label} 
            className="group border border-border bg-surface-elevated p-5 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 transition-transform group-hover:scale-110 ${c.bgIcon}`} />
            <div className={`size-10 rounded-full flex items-center justify-center mb-4 shadow-inner ${c.bgIcon}`}>
              <c.icon className={`size-5 ${c.color}`} />
            </div>
            <div className="text-3xl font-display relative z-10">{c.value}</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2 relative z-10">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Sección del Podio y Lista */}
      <div className="border border-border bg-surface-elevated rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-amber-500" />
            <h2 className="font-display text-lg tracking-wide">Ranking de Productos (Top 100)</h2>
          </div>
        </div>

        {!topProductos || topProductos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No hay datos de ventas en este periodo.
          </div>
        ) : (
          <div className="p-4 sm:p-8">
            {/* El Podio Visual */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-2 sm:gap-6 pt-10 pb-8 h-72 border-b border-border/50 mb-6">
                {/* 2do Puesto */}
                {top3[1] && (
                  <div className="flex flex-col items-center w-1/3 max-w-[140px] group animate-in slide-in-from-bottom-8 duration-700 fade-in">
                    <div className="text-center mb-3 transition-transform group-hover:-translate-y-2">
                      <div className="text-xs sm:text-sm font-semibold line-clamp-2 px-2 text-foreground/80">{top3[1].nombre}</div>
                      <div className="text-xs font-medium text-slate-500 mt-1 bg-slate-100 rounded-full px-2 py-0.5 inline-block">{top3[1].cantidad} u.</div>
                    </div>
                    <div className="w-full h-24 bg-gradient-to-t from-slate-300 to-slate-200 rounded-t-lg flex items-start justify-center pt-2 font-display text-4xl text-slate-500 shadow-md border border-slate-300 border-b-0 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20"></div>
                      2
                    </div>
                  </div>
                )}

                {/* 1er Puesto */}
                {top3[0] && (
                  <div className="flex flex-col items-center w-1/3 max-w-[160px] group animate-in slide-in-from-bottom-12 duration-1000 fade-in">
                    <div className="text-center mb-4 transition-transform group-hover:-translate-y-2 relative">
                      <Trophy className="size-8 text-amber-500 mx-auto mb-2 drop-shadow-md animate-bounce" />
                      <div className="text-sm sm:text-base font-bold line-clamp-2 px-2">{top3[0].nombre}</div>
                      <div className="text-xs font-medium text-amber-700 mt-1 bg-amber-100 rounded-full px-3 py-1 inline-block shadow-sm">{top3[0].cantidad} u.</div>
                    </div>
                    <div className="w-full h-36 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-lg flex items-start justify-center pt-3 font-display text-5xl text-amber-700 shadow-lg border border-amber-400 border-b-0 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20"></div>
                      1
                    </div>
                  </div>
                )}

                {/* 3er Puesto */}
                {top3[2] && (
                  <div className="flex flex-col items-center w-1/3 max-w-[130px] group animate-in slide-in-from-bottom-4 duration-500 fade-in">
                    <div className="text-center mb-2 transition-transform group-hover:-translate-y-2">
                      <div className="text-xs sm:text-sm font-semibold line-clamp-2 px-2 text-foreground/80">{top3[2].nombre}</div>
                      <div className="text-xs font-medium text-orange-700 mt-1 bg-orange-100 rounded-full px-2 py-0.5 inline-block">{top3[2].cantidad} u.</div>
                    </div>
                    <div className="w-full h-16 bg-gradient-to-t from-orange-300 to-orange-200 rounded-t-lg flex items-start justify-center pt-1 font-display text-3xl text-orange-700 shadow-sm border border-orange-300 border-b-0 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20"></div>
                      3
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista de los siguientes 100 */}
            {restTop.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 pl-2">Resto del Ranking</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {restTop.map((p, i) => (
                    <li key={p.nombre} className="px-3 py-2 flex items-center justify-between gap-3 text-sm hover:bg-muted/50 rounded-md transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground w-6 text-right">#{i + 4}</span>
                        <span className="min-w-0 font-medium truncate">{p.nombre}</span>
                      </div>
                      <span className="font-semibold text-muted-foreground whitespace-nowrap">{p.cantidad} u.</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
