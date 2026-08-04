import { formatARS } from "@/lib/format";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email";

type OrderEmailItem = {
  nombre: string;
  cantidad: number;
  precio_unitario?: number | null;
  subtotal: number;
};

type OrderShippingMethod = {
  descripcion?: string | null;
  servicio?: string | null;
  codigo_servicio?: string | null;
};

type OrderAddress = {
  calle?: string | null;
  numero?: string | null;
  piso?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  codigo_postal?: string | null;
};

type OrderEmailData = {
  id: string;
  email: string | null;
  nombre: string | null;
  telefono: string | null;
  total: number;
  subtotal_productos?: number | null;
  envio_total?: number | null;
  envio_metodo?: OrderShippingMethod | null;
  direccion?: OrderAddress | null;
  pedido_items?: OrderEmailItem[];
};

export async function sendOrderConfirmationEmail(order: OrderEmailData): Promise<boolean> {
  const to = order.email?.trim();

  if (!to) {
    console.warn("[email] order has no recipient email", { pedidoId: order.id });
    return false;
  }

  const subject = `Confirmacion de compra Decasan #${order.id.slice(0, 8)}`;
  const html = buildOrderEmailHtml(order);
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logContext: { kind: "order_confirmation", pedidoId: order.id },
  });
}

function buildOrderEmailHtml(order: OrderEmailData): string {
  const items = order.pedido_items ?? [];
  const shipping = order.envio_metodo;
  const shippingDescription = shipping?.descripcion ?? shipping?.servicio ?? "Entrega a coordinar";
  const isPickup = shipping?.codigo_servicio === "retiro-local";

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.45;max-width:640px;margin:0 auto">
      <h1 style="font-size:24px;margin:0 0 8px">Gracias por tu compra</h1>
      <p style="margin:0 0 20px">Hola ${escapeHtml(order.nombre || "cliente")}, recibimos tu pago correctamente.</p>

      <div style="border:1px solid #e5e7eb;padding:16px;margin-bottom:18px">
        <div><strong>Pedido:</strong> ${escapeHtml(order.id)}</div>
        <div><strong>Total pagado:</strong> ${formatARS(order.total)}</div>
        <div><strong>Metodo de entrega:</strong> ${escapeHtml(shippingDescription)}</div>
        <div><strong>Costo de envio:</strong> ${formatARS(order.envio_total ?? 0)}</div>
      </div>

      <h2 style="font-size:18px;margin:0 0 10px">Detalle de productos</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <thead>
          <tr>
            <th align="left" style="border-bottom:1px solid #e5e7eb;padding:8px 0">Producto</th>
            <th align="center" style="border-bottom:1px solid #e5e7eb;padding:8px 0">Cant.</th>
            <th align="right" style="border-bottom:1px solid #e5e7eb;padding:8px 0">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:8px 0">${escapeHtml(item.nombre)}</td>
                  <td align="center" style="border-bottom:1px solid #f1f5f9;padding:8px 0">${item.cantidad}</td>
                  <td align="right" style="border-bottom:1px solid #f1f5f9;padding:8px 0">${formatARS(item.subtotal)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>

      <div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal productos</span><strong>${formatARS(order.subtotal_productos ?? 0)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span>Entrega</span><strong>${formatARS(order.envio_total ?? 0)}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:18px;margin-top:8px"><span>Total</span><strong>${formatARS(order.total)}</strong></div>
      </div>

      ${
        isPickup
          ? `<p><strong>Retiro:</strong> podes retirar por Av. Pres. Kennedy 270, La Falda, Cordoba. Te vamos a contactar cuando el pedido este listo.</p>`
          : `<p><strong>Direccion de envio:</strong> ${escapeHtml(formatAddress(order.direccion))}</p>`
      }

      <p style="font-size:13px;color:#64748b;margin-top:24px">Ante cualquier consulta, responde este email o escribinos por WhatsApp.</p>
    </div>
  `;
}

function formatAddress(address: OrderAddress | null | undefined): string {
  if (!address) return "A coordinar";
  return [
    [address.calle, address.numero].filter(Boolean).join(" "),
    address.piso,
    address.ciudad,
    address.provincia,
    address.codigo_postal ? `CP ${address.codigo_postal}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
