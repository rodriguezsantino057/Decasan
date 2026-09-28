import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { 
  adminListPedidos, 
  adminUpdatePedidoEstado, 
  adminGetShippingLabel,
  adminListShippingOptions,
  adminUpdateShippingOption,
  adminGetZipnovaShipmentTracking
} from "@/lib/admin.functions";
import type { AdminShippingRow } from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { LOCAL_PICKUP_CODE, TRANSPORTISTA_LABEL } from "@/lib/shipping.functions";
import type { Transportista } from "@/lib/shipping.functions";
import { Calendar, Check, CircleOff, Pencil, Power, Truck, X, Loader2, PackageSearch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: AdminPedidos });

const ESTADOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado"] as const;
const TRANSPORTISTA_ORDER: Transportista[] = ["retiro_local", "cadete"];

function AdminPedidos() {
  const [tab, setTab] = useState<"listado" | "tarifas">("listado");

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-border mb-4 text-sm font-medium">
        <button 
          onClick={() => setTab("listado")} 
          className={`pb-2 -mb-px border-b-2 ${tab === "listado" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Listado de Pedidos
        </button>
        <button 
          onClick={() => setTab("tarifas")} 
          className={`pb-2 -mb-px border-b-2 ${tab === "tarifas" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Tarifas de Envío
        </button>
      </div>

      {tab === "listado" ? <PedidosListado /> : <TarifasEnvio />}
    </div>
  );
}

function extractTrackingEvents(tracking: any): any[] {
  if (!tracking) return [];
  const candidates = [
    tracking.data,
    tracking.tracking,
    tracking.events,
    tracking.history,
    tracking.trackings,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  if (Array.isArray(tracking)) return tracking;
  return [];
}

function PedidosListado() {
  const qc = useQueryClient();
  const list = useServerFn(adminListPedidos);
  const update = useServerFn(adminUpdatePedidoEstado);
  const getLabel = useServerFn(adminGetShippingLabel);
  const getTracking = useServerFn(adminGetZipnovaShipmentTracking);

  const { data } = useQuery({ queryKey: ["admin-pedidos"], queryFn: () => list() });

  const [filtro, setFiltro] = useState<string>("todos");
  const [trackingData, setTrackingData] = useState<Record<string, { loading: boolean, events?: any[] }>>({});

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const pedidosMes = data?.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length || 0;

  const counts = ESTADOS.reduce((acc, estado) => {
    acc[estado] = data?.filter((p) => p.estado === estado).length || 0;
    return acc;
  }, {} as Record<string, number>);

  const filteredData = data?.filter((p) => filtro === "todos" || p.estado === filtro);

  async function loadTracking(pedidoId: string, trackingNumber: string) {
    setTrackingData(prev => ({ ...prev, [pedidoId]: { loading: true } }));
    try {
      const t = await getTracking({ data: { id: trackingNumber } });
      setTrackingData(prev => ({ ...prev, [pedidoId]: { loading: false, events: extractTrackingEvents(t) } }));
    } catch (err: any) {
      toast.error(err.message || "Error al cargar seguimiento");
      setTrackingData(prev => ({ ...prev, [pedidoId]: { loading: false, events: [] } }));
    }
  }

  return (
    <div className="space-y-4 pb-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="bg-surface-elevated border border-border p-4 flex items-center gap-4">
           <Calendar className="size-8 text-primary" />
           <div>
             <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Pedidos del mes</h3>
             <p className="text-2xl font-display mt-0.5">{pedidosMes}</p>
           </div>
        </div>
        
        <div className="sm:col-span-2 flex flex-col justify-center">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setFiltro("todos")} 
              className={`px-3 py-1.5 text-xs font-medium border ${filtro === "todos" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
            >
              Todos ({data?.length || 0})
            </button>
            {ESTADOS.map(estado => (
              <button 
                key={estado} 
                onClick={() => setFiltro(estado)} 
                className={`px-3 py-1.5 text-xs font-medium border capitalize ${filtro === estado ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
              >
                {estado} ({counts[estado]})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredData?.length === 0 && <p className="text-muted-foreground text-sm">No hay pedidos para este filtro.</p>}
        {filteredData?.map((p) => {
          const shipping = p.envio_metodo as any;
          const isLocalPickup = shipping?.codigo_servicio === LOCAL_PICKUP_CODE || !p.direccion;
          const deliveryLabel = isLocalPickup ? "Retiro en local" : "Envio";
          const shippingCost = Number(p.envio_total ?? p.costo_envio ?? 0);
          const shippingDescription = shipping?.descripcion ?? shipping?.label ?? p.transportista;
          const trackingNumber = (p as any).tracking_number || p.andreani_tracking_number;
          const carrier = (p as any).carrier || p.transportista;
          const carrierLabel = carrier === "zipnova" ? "Zipnova" : carrier === "andreani" ? "Andreani" : "Envio";

          const tData = trackingData[p.id];

          return (
            <details key={p.id} className="border border-border bg-surface-elevated">
              <summary className="px-3 py-3 sm:px-4 cursor-pointer grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">#{p.id.slice(0, 8)}</div>
                  <div className="text-sm font-medium">
                    {p.nombre} <span className="text-muted-foreground">- {p.email}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(p.created_at).toLocaleString("es-AR")}</span>
                    <span className="border border-border bg-background px-2 py-0.5 font-medium text-foreground">
                      {deliveryLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <select
                    value={p.estado}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      await update({ data: { id: p.id, estado: e.target.value as any } });
                      toast.success("Estado actualizado");
                      qc.invalidateQueries({ queryKey: ["admin-pedidos"] });
                    }}
                    className="min-w-0 border border-border bg-background px-2 py-1.5 text-xs capitalize"
                  >
                    {ESTADOS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="font-display whitespace-nowrap">{formatARS(Number(p.total))}</span>
                </div>
              </summary>
              <div className="px-3 py-3 sm:px-4 border-t border-border bg-secondary/30 text-sm space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p><strong>Tel:</strong> {p.telefono}</p>
                    <p>
                      <strong>Entrega:</strong> {deliveryLabel}
                      {shippingDescription ? ` - ${shippingDescription}` : ""}
                    </p>
                    {!isLocalPickup && p.direccion && (
                      <p>
                        <strong>Direccion:</strong> {(p.direccion as any).calle} {(p.direccion as any).numero},{" "}
                        {(p.direccion as any).ciudad}, {(p.direccion as any).provincia} (CP{" "}
                        {(p.direccion as any).codigo_postal})
                      </p>
                    )}
                    {(p.envio_total != null || p.costo_envio != null) && (
                      <p><strong>Costo de envio:</strong> {shippingCost === 0 ? "Sin costo" : formatARS(shippingCost)}</p>
                    )}
                    {p.notas && (
                      <p className="whitespace-pre-line mt-2 text-muted-foreground border-l-2 border-primary pl-2">
                        {p.notas}
                      </p>
                    )}
                  </div>
                  <div>
                    {p.mp_payment_id && <p className="text-xs text-muted-foreground">MP: {p.mp_payment_id}</p>}
                    {p.payment_method && (
                      <p className="text-xs text-muted-foreground mt-1">Metodo de pago: {p.payment_method}</p>
                    )}
                    <div className="mt-3">
                      <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Productos</h4>
                      <ul className="space-y-1">
                        {p.pedido_items?.map((it: any) => (
                          <li key={it.id} className="flex justify-between">
                            <span>{it.cantidad}x {it.nombre}</span>
                            <span className="text-muted-foreground">{formatARS(Number(it.subtotal))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {trackingNumber && (
                  <div className="border-t border-border pt-4 mt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p><strong>Tracking {carrierLabel}:</strong> <span className="font-mono">{trackingNumber}</span></p>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            toast.loading("Obteniendo etiqueta...", { id: `label-${p.id}` });
                            const base64 = await getLabel({ data: { trackingNumber: trackingNumber as string } });
                            const link = document.createElement("a");
                            link.href = `data:application/pdf;base64,${base64}`;
                            link.download = `Etiqueta_${carrierLabel}_${trackingNumber}.pdf`;
                            link.click();
                            toast.success("Etiqueta descargada", { id: `label-${p.id}` });
                          } catch (err: any) {
                            toast.error(err.message || "Error al descargar etiqueta", { id: `label-${p.id}` });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Descargar PDF
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tData) {
                            setTrackingData(prev => { const n = {...prev}; delete n[p.id]; return n; });
                          } else {
                            loadTracking(p.id, trackingNumber as string);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <PackageSearch className="size-3.5" />
                        {tData ? "Ocultar Seguimiento" : "Ver Seguimiento"}
                      </button>
                    </div>

                    {tData && (
                      <div className="mt-3 bg-background border border-border p-3">
                        {tData.loading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> Cargando eventos...
                          </div>
                        ) : tData.events?.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sin eventos de seguimiento.</p>
                        ) : (
                          <ol className="space-y-2">
                            {tData.events?.map((ev: any, i: number) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                <div>
                                  <p className="text-sm">{ev.description || ev.status || ev.message || "Evento"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(ev.date || ev.created_at || ev.timestamp || ev.datetime).toLocaleString("es-AR")}
                                    {ev.location ? ` — ${ev.location}` : ""}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function TarifasEnvio() {
  const qc = useQueryClient();
  const listShipping = useServerFn(adminListShippingOptions);
  const updateShipping = useServerFn(adminUpdateShippingOption);
  
  const { data: rows = [], isLoading, error } = useQuery<AdminShippingRow[]>({
    queryKey: ["admin-shipping"],
    queryFn: () => listShipping(),
  });

  const grouped = TRANSPORTISTA_ORDER.map((transportista) => ({
    transportista,
    options: rows.filter((row) => row.transportista === transportista),
  })).filter((group) => group.options.length > 0);

  async function toggleActivo(row: AdminShippingRow) {
    try {
      await updateShipping({ data: { id: row.id, activo: !row.activo } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la opcion");
      return;
    }
    toast.success(row.activo ? "Opcion desactivada" : "Opcion activada");
    qc.invalidateQueries({ queryKey: ["admin-shipping"] });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando configuracion de envios...</p>;
  if (error) return (
    <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <p className="font-medium">No se pudieron cargar las tarifas de envio.</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Truck className="size-5 text-primary" />
        <div>
          <h2 className="font-display text-xl">Tarifas de envio manuales</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edita costos y disponibilidad de las opciones de retiro en local o cadete. (Los envíos por correo se cotizan automáticamente).
          </p>
        </div>
      </div>

      {grouped.map(({ transportista, options }) => (
        <section key={transportista} className="border border-border bg-surface-elevated">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <span className="font-display text-sm tracking-wide">{TRANSPORTISTA_LABEL[transportista] ?? transportista}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {options.filter((option) => option.activo).length}/{options.length} activas
            </span>
          </div>
          <div className="divide-y divide-border">
            {options.map((row) => (
              <ShippingRow
                key={row.id}
                row={row}
                onSave={updateShipping}
                onToggle={toggleActivo}
                onSaved={() => qc.invalidateQueries({ queryKey: ["admin-shipping"] })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ShippingRow({ row, onSave, onToggle, onSaved }: {
  row: AdminShippingRow;
  onSave: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  onToggle: (row: AdminShippingRow) => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [costo, setCosto] = useState(String(row.costo));
  const [diasMin, setDiasMin] = useState(String(row.dias_estimados_min ?? ""));
  const [diasMax, setDiasMax] = useState(String(row.dias_estimados_max ?? ""));
  const [saving, setSaving] = useState(false);

  async function save() {
    const costoNum = Number(costo);
    const min = diasMin === "" ? null : Number(diasMin);
    const max = diasMax === "" ? null : Number(diasMax);
    
    if (!Number.isFinite(costoNum) || costoNum < 0) return toast.error("Costo invalido");
    if (min != null && max != null && min > max) return toast.error("Dias invalidos");

    setSaving(true);
    try {
      await onSave({ data: { id: row.id, costo: costoNum, dias_estimados_min: min, dias_estimados_max: max } });
    } catch (err: any) {
      setSaving(false);
      return toast.error(err.message || "Error al actualizar");
    }
    setSaving(false);
    toast.success("Tarifa actualizada");
    setEditing(false);
    onSaved();
  }

  function cancel() {
    setCosto(String(row.costo));
    setDiasMin(String(row.dias_estimados_min ?? ""));
    setDiasMax(String(row.dias_estimados_max ?? ""));
    setEditing(false);
  }

  return (
    <div className={`px-4 py-3 flex flex-wrap items-center gap-3 text-sm ${!row.activo ? "opacity-55" : ""}`}>
      <div className="flex-1 min-w-56">
        <div className="font-medium truncate">{row.label}</div>
        {!editing && (
          <div className="text-xs text-muted-foreground">
            {row.dias_estimados_min === 0 && row.dias_estimados_max === 0
              ? "Inmediato"
              : `${row.dias_estimados_min ?? "-"}-${row.dias_estimados_max ?? "-"} dias habiles`}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            $<input type="number" min={0} step={100} value={costo} onChange={(e) => setCosto(e.target.value)} className="w-24 border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            min <input type="number" min={0} value={diasMin} onChange={(e) => setDiasMin(e.target.value)} className="w-16 border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            max <input type="number" min={0} value={diasMax} onChange={(e) => setDiasMax(e.target.value)} className="w-16 border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" />
          </label>
          <button type="button" onClick={save} disabled={saving} className="text-success hover:text-success/80 disabled:opacity-50" title="Guardar"><Check className="size-4" /></button>
          <button type="button" onClick={cancel} className="text-muted-foreground hover:text-destructive" title="Cancelar"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-display text-base">{row.costo === 0 ? "Gratis" : formatARS(row.costo)}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary" title="Editar tarifa"><Pencil className="size-3.5" /></button>
        </div>
      )}

      <button type="button" onClick={() => onToggle(row)} className={`ml-auto shrink-0 ${row.activo ? "text-primary" : "text-muted-foreground"}`} title={row.activo ? "Desactivar" : "Activar"}>
        {row.activo ? <Power className="size-5" /> : <CircleOff className="size-5" />}
      </button>
    </div>
  );
}
