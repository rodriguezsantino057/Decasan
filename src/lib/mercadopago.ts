import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  preference_id?: string;
};

export function getMercadoPagoAccessToken() {
  return cleanEnvValue(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "");
}

export function getPublicBaseUrl() {
  const baseUrl = process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "";
  return cleanEnvValue(baseUrl).replace(/\/+$/, "");
}

function cleanEnvValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function assertValidPublicBaseUrl(baseUrl: string) {
  if (!baseUrl) {
    throw new Error("Falta configurar PUBLIC_BASE_URL para Mercado Pago");
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL no es una URL valida");
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" || isLocal) {
    throw new Error("PUBLIC_BASE_URL debe ser una URL publica con HTTPS para Mercado Pago");
  }
}

export function mapMercadoPagoStatus(status: string | undefined) {
  switch (status) {
    case "approved":
      return "pagado";
    case "pending":
    case "in_process":
    case "authorized":
      return "pendiente";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      return "pendiente";
  }
}

export async function fetchMercadoPagoPayment(paymentId: string, accessToken: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Mercado Pago respondio ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as MercadoPagoPayment;
}

export async function applyMercadoPagoPayment(payment: MercadoPagoPayment) {
  const pedidoId = payment.external_reference;
  if (!pedidoId) return { ok: false, reason: "missing_external_reference" };

  const { data: pedido, error: readError } = await supabaseAdmin
    .from("pedidos")
    .select("id,total,mp_preference_id,confirmation_email_sent_at")
    .eq("id", pedidoId)
    .single();

  if (readError || !pedido) {
    console.error("[mp] order lookup failed", { pedidoId, error: readError?.message });
    return { ok: false, reason: "order_not_found" };
  }

  if (payment.preference_id && pedido.mp_preference_id && payment.preference_id !== pedido.mp_preference_id) {
    console.error("[mp] preference mismatch", {
      pedidoId,
      expectedPreferenceId: pedido.mp_preference_id,
      receivedPreferenceId: payment.preference_id,
    });
    return { ok: false, reason: "preference_mismatch" };
  }

  const expectedTotal = Number(pedido.total);
  const receivedTotal = Number(payment.transaction_amount ?? 0);
  if (payment.status === "approved" && Math.abs(expectedTotal - receivedTotal) > 0.01) {
    console.error("[mp] amount mismatch", { pedidoId, expectedTotal, receivedTotal });
    return { ok: false, reason: "amount_mismatch" };
  }

  const estado = mapMercadoPagoStatus(payment.status);
  const { error: updateError } = await supabaseAdmin
    .from("pedidos")
    .update({ estado, mp_payment_id: String(payment.id) })
    .eq("id", pedidoId);

  if (updateError) {
    console.error("[mp] order status update failed", { pedidoId, error: updateError.message });
    return { ok: false, reason: "update_failed" };
  }

  if (estado === "pagado" && !pedido.confirmation_email_sent_at) {
    await sendPaidOrderEmail(pedidoId);
  }

  return { ok: true, estado };
}

export async function verifyMercadoPagoWebhookSignature(request: Request, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  const parts = new Map(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.get("ts");
  const hash = parts.get("v1");
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeHexEqual(expected, hash);
}

async function sendPaidOrderEmail(pedidoId: string) {
  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select("id,email,nombre,telefono,total,subtotal_productos,envio_total,envio_metodo,direccion,confirmation_email_sent_at,pedido_items(nombre,cantidad,precio_unitario,subtotal)")
    .eq("id", pedidoId)
    .single();

  if (error || !pedido) {
    console.error("[mp] paid order lookup failed", { pedidoId, error: error?.message });
    return;
  }

  if ((pedido as any).confirmation_email_sent_at) return;

  const sent = await sendOrderConfirmationEmail(pedido as any);
  if (sent) {
    await supabaseAdmin
      .from("pedidos")
      .update({ confirmation_email_sent_at: new Date().toISOString() } as any)
      .eq("id", pedidoId);
  }
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeHexEqual(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
