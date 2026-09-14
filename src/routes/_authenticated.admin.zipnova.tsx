import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, Download, Loader2, PackageSearch, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  adminListZipnovaShipments,
  adminGetZipnovaShipmentDetail,
  adminGetZipnovaShipmentTracking,
  adminGetShippingLabel,
} from "@/lib/admin.functions";
import type { ZipnovaShipmentSummary } from "@/lib/zipnova";
import { formatARS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/zipnova")({ component: AdminZipnova });

const STATUS_LABEL: Record<string, string> = {
  created: "Creado",
  pending: "Pendiente",
  processing: "En proceso",
  in_transit: "En tránsito",
  delivered: "Entregado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  error: "Error",
};

function statusLabel(status?: string): string {
  if (!status) return "—";
  const key = String(status).toLowerCase().replace(/\s+/g, "_");
  return STATUS_LABEL[key] ?? String(status);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

/** Extrae eventos de seguimiento de la respuesta de tracking (estructura variable). */
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

function AdminZipnova() {
  const qc = useQueryClient();
  const list = useServerFn(adminListZipnovaShipments);
  const getDetail = useServerFn(adminGetZipnovaShipmentDetail);
  const getTracking = useServerFn(adminGetZipnovaShipmentTracking);
  const getLabel = useServerFn(adminGetShippingLabel);

  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-zipnova", page],
    queryFn: () => list({ data: { page, perPage: 20 } }),
  });

  async function toggleExpand(shipment: ZipnovaShipmentSummary) {
    if (expandedId === shipment.id) {
      setExpandedId(null);
      setDetail(null);
      setTracking(null);
      return;
    }
    setExpandedId(shipment.id);
    setLoadingDetail(true);
    setDetail(null);
    setTracking(null);
    try {
      const [d, t] = await Promise.all([
        getDetail({ data: { id: shipment.id } }),
        getTracking({ data: { id: shipment.id } }),
      ]);
      setDetail(d);
      setTracking(t);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el detalle del envío");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function downloadLabel(shipment: ZipnovaShipmentSummary) {
    const id = shipment.trackingNumber || shipment.id;
    try {
      const base64 = await getLabel({ data: { trackingNumber: String(id) } });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = `zipnova-${id}.pdf`;
      link.click();
      toast.success("Etiqueta descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar la etiqueta");
    }
  }

  const events = extractTrackingEvents(tracking);
  const shipments = data?.data ?? [];
  const total = data?.total ?? 0;
  const lastPage = data?.lastPage ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PackageSearch className="size-5 text-primary" />
        <div className="flex-1">
          <h2 className="font-display text-xl">Zipnova</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envíos creados en Zipnova: estado, seguimiento y etiquetas.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando envíos de Zipnova...
        </div>
      ) : error ? (
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">No se pudieron cargar los envíos.</p>
          <p className="mt-1 text-xs">{error instanceof Error ? error.message : "Error desconocido"}</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="border border-border bg-muted/30 p-8 text-center">
          <Truck className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No hay envíos en Zipnova todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando un pedido pague y se despache, va a aparecer acá con su estado y seguimiento.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-border bg-surface-elevated divide-y divide-border">
            {shipments.map((shipment) => {
              const isOpen = expandedId === shipment.id;
              const dest = shipment.destination;
              return (
                <div key={String(shipment.id)}>
                  <button
                    onClick={() => toggleExpand(shipment)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40"
                  >
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{String(shipment.id)}</span>
                        {shipment.externalId && (
                          <span className="font-mono text-xs text-muted-foreground/70">pedido {shipment.externalId}</span>
                        )}
                        <span className="border border-border bg-background px-2 py-0.5 text-xs font-medium">
                          {statusLabel(shipment.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium truncate">
                        {dest?.name || "Destino sin nombre"}
                        {dest?.city ? ` — ${dest.city}${dest?.state ? `, ${dest.state}` : ""}` : ""}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{shipment.carrierName || "—"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(shipment.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadLabel(shipment);
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
                      title="Descargar etiqueta PDF"
                    >
                      <Download className="size-3.5" /> Etiqueta
                    </button>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-border bg-secondary/30">
                      {loadingDetail ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Cargando detalle y seguimiento...
                        </div>
                      ) : (
                        <div className="grid gap-4 pt-4 sm:grid-cols-2">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Detalle</p>
                            <p><strong>Carrier:</strong> {shipment.carrierName || "—"}</p>
                            <p><strong>Servicio:</strong> {shipment.serviceType || "—"}</p>
                            <p><strong>Tracking:</strong> <span className="font-mono">{shipment.trackingNumber || "—"}</span></p>
                            <p><strong>Precio:</strong> {shipment.price ? formatARS(shipment.price) : "—"}</p>
                            {dest?.street && <p><strong>Dirección:</strong> {dest.street}</p>}
                            {dest?.zipcode && <p><strong>CP:</strong> {dest.zipcode}</p>}
                            <p><strong>Creado:</strong> {formatDate(shipment.createdAt)}</p>
                          </div>

                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Seguimiento</p>
                            {events.length === 0 ? (
                              <p className="text-muted-foreground">Sin eventos de seguimiento.</p>
                            ) : (
                              <ol className="space-y-2">
                                {events.map((ev: any, i: number) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                    <div>
                                      <p className="text-sm">{ev.description || ev.status || ev.message || "Evento"}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDate(ev.date || ev.created_at || ev.timestamp || ev.datetime)}
                                        {ev.location ? ` — ${ev.location}` : ""}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => setShowRaw((v) => !v)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {showRaw ? "Ocultar JSON" : "Ver JSON crudo"}
                        </button>
                      </div>
                      {showRaw && (
                        <pre className="mt-2 max-h-80 overflow-auto border border-border bg-background p-3 text-xs">
                          {JSON.stringify({ shipment: shipment.raw, detail, tracking }, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">
                {total} envíos — página {page} de {lastPage}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}