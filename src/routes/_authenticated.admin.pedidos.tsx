import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListPedidos, adminUpdatePedidoEstado } from "@/lib/admin.functions";
import { formatARS } from "@/lib/format";
import { LOCAL_PICKUP_CODE } from "@/lib/shipping.functions";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: AdminPedidos });

const ESTADOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado"] as const;

function AdminPedidos() {
  const qc = useQueryClient();
  const list = useServerFn(adminListPedidos);
  const update = useServerFn(adminUpdatePedidoEstado);
  const { data } = useQuery({ queryKey: ["admin-pedidos"], queryFn: () => list() });

  return (
    <div className="space-y-3">
      {data?.length === 0 && <p className="text-muted-foreground text-sm">Aun no hay pedidos.</p>}
      {data?.map((p) => {
        const shipping = p.envio_metodo as any;
        const isLocalPickup = shipping?.codigo_servicio === LOCAL_PICKUP_CODE || !p.direccion;
        const deliveryLabel = isLocalPickup ? "Retiro en local" : "Envio";
        const shippingCost = Number(p.envio_total ?? p.costo_envio ?? 0);
        const shippingDescription = shipping?.descripcion ?? shipping?.label ?? p.transportista;

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
                  className="min-w-0 border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {ESTADOS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="font-display whitespace-nowrap">{formatARS(Number(p.total))}</span>
              </div>
            </summary>
            <div className="px-3 py-3 sm:px-4 border-t border-border bg-secondary/30 text-sm space-y-1">
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
                <p className="whitespace-pre-line"><strong>Notas:</strong> {p.notas}</p>
              )}
              {p.mp_payment_id && <p className="text-xs text-muted-foreground">MP: {p.mp_payment_id}</p>}
              <ul className="mt-2 space-y-1">
                {p.pedido_items?.map((it: any) => (
                  <li key={it.id}>{it.cantidad}x {it.nombre} - {formatARS(Number(it.subtotal))}</li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}
    </div>
  );
}
