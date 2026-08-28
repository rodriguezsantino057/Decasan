import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPaidOrderEmail } from "@/lib/order-email";
import { createAndreaniShipping } from "@/lib/andreani";

const DEFAULT_MODO_BASE_URL = "https://api.modo.com.ar";

export type ModoConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  storeId: string;
  terminalId: string;
  webhookSecret: string;
};

export type ModoPaymentIntention = {
  id?: string;
  status?: string;
  qr?: string | null;
  checkoutUrl?: string | null;
  externalIntentionId?: string;
};

export type ModoPaymentPayload = {
  id?: string | number;
  intention_id?: string | number;
  external_intention_id?: string;
  external_reference?: string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  amount?: number;
};

export function getModoConfig(): ModoConfig {
  return {
    baseUrl: cleanEnvValue(process.env.MODO_BASE_URL || DEFAULT_MODO_BASE_URL).replace(/\/+$/, ""),
    clientId: cleanEnvValue(process.env.MODO_CLIENT_ID || ""),
    clientSecret: cleanEnvValue(process.env.MODO_CLIENT_SECRET || ""),
    storeId: cleanEnvValue(process.env.MODO_STORE_ID || ""),
    terminalId: cleanEnvValue(process.env.MODO_TERMINAL_ID || ""),
    webhookSecret: cleanEnvValue(process.env.MODO_WEBHOOK_SECRET || ""),
  };
}

export function isModoConfigured() {
  const config = getModoConfig();
  return Boolean(config.clientId && config.clientSecret && config.storeId);
}

function cleanEnvValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getModoAccessToken(): Promise<string> {
  const config = getModoConfig();
  if (cachedToken && Date.now() / 1000 < cachedToken.expiresAt - 60) {
    return cachedToken.token;
  }

  const resp = await fetch(`${config.baseUrl}/middleman/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username: config.clientId, password: config.clientSecret }),
  });

  if (!resp.ok) {
    throw new Error(`MODO autenticacion fallo: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  const accessToken = data?.accessToken ?? data?.access_token ?? data?.token;
  if (!accessToken) {
    throw new Error("MODO no devolvio un access token");
  }

  cachedToken = { token: `Bearer ${accessToken}`, expiresAt: getTokenExpiry(accessToken) };
  return cachedToken.token;
}

export async function createModoPaymentIntention(input: {
  amount: number;
  externalIntentionId: string;
  description: string;
}): Promise<ModoPaymentIntention> {
  const config = getModoConfig();
  const token = await getModoAccessToken();

  const body = {
    productName: input.description.slice(0, 250),
    price: input.amount,
    quantity: 1,
    terminalId: config.terminalId || "123",
    storeId: config.storeId,
    externalIntentionId: input.externalIntentionId,
    currency: "ARS",
  };

  const resp = await fetch(`${config.baseUrl}/ecommerce/payment-intention`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: token,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`MODO no pudo crear la intencion de pago: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return {
    id: String(data?.id ?? data?.checkoutId ?? data?.paymentIntentionId ?? ""),
    status: data?.status,
    qr: data?.qr ?? data?.qrString ?? data?.qrImage ?? null,
    checkoutUrl: data?.checkoutUrl ?? data?.checkout_url ?? data?.url ?? null,
    externalIntentionId: input.externalIntentionId,
  };
}

export async function getModoIntention(intentionId: string): Promise<ModoPaymentIntention> {
  const config = getModoConfig();
  const token = await getModoAccessToken();

  const resp = await fetch(`${config.baseUrl}/ecommerce/payment-intention/${intentionId}`, {
    headers: { accept: "application/json", Authorization: token },
  });

  if (!resp.ok) {
    throw new Error(`MODO respondio ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  return {
    id: String(data?.id ?? intentionId),
    status: data?.status,
    qr: data?.qr ?? data?.qrString ?? null,
    checkoutUrl: data?.checkoutUrl ?? data?.checkout_url ?? null,
    externalIntentionId: data?.externalIntentionId ?? data?.external_intention_id,
  };
}

export function mapModoStatus(status: string | undefined): "pendiente" | "pagado" | "cancelado" {
  switch (status?.toUpperCase()) {
    case "APPROVED":
    case "PAID":
    case "SETTLED":
    case "COMPLETED":
    case "SUCCESS":
      return "pagado";
    case "REJECTED":
    case "CANCELLED":
    case "CANCELED":
    case "EXPIRED":
    case "FAILED":
    case "REFUNDED":
      return "cancelado";
    default:
      return "pendiente";
  }
}

export async function applyModoPayment(payment: ModoPaymentPayload) {
  const pedidoId = String(
    payment.external_intention_id ?? payment.intention_id ?? payment.external_reference ?? "",
  );
  if (!pedidoId) return { ok: false, reason: "missing_external_intention_id" };

  const { data: pedido, error: readError } = await supabaseAdmin
    .from("pedidos")
    .select("id,total,modo_intention_id,confirmation_email_sent_at,transportista,email,nombre,telefono,direccion,andreani_tracking_number")
    .eq("id", pedidoId)
    .single();

  if (readError || !pedido) {
    console.error("[modo] order lookup failed", { pedidoId, error: readError?.message });
    return { ok: false, reason: "order_not_found" };
  }

  const receivedIntentionId = String(payment.id ?? "");
  if (receivedIntentionId && pedido.modo_intention_id && receivedIntentionId !== pedido.modo_intention_id) {
    console.error("[modo] intention mismatch", {
      pedidoId,
      expectedIntentionId: pedido.modo_intention_id,
      receivedIntentionId,
    });
    return { ok: false, reason: "intention_mismatch" };
  }

  const expectedTotal = Number(pedido.total);
  const receivedTotal = Number(payment.transaction_amount ?? payment.amount ?? 0);
  if (mapModoStatus(payment.status) === "pagado" && receivedTotal > 0 && Math.abs(expectedTotal - receivedTotal) > 0.01) {
    console.error("[modo] amount mismatch", { pedidoId, expectedTotal, receivedTotal });
    return { ok: false, reason: "amount_mismatch" };
  }

  const estado = mapModoStatus(payment.status);
  const patch: Record<string, unknown> = { estado };
  if (receivedIntentionId) patch.modo_payment_id = receivedIntentionId;

  const { error: updateError } = await supabaseAdmin.from("pedidos").update(patch as any).eq("id", pedidoId);
  if (updateError) {
    console.error("[modo] order status update failed", { pedidoId, error: updateError.message });
    return { ok: false, reason: "update_failed" };
  }

  if (estado === "pagado") {
    if (pedido.transportista === "andreani" && !pedido.andreani_tracking_number) {
      try {
        const tracking = await createAndreaniShipping(pedidoId, pedido);
        if (tracking) {
          await supabaseAdmin.from("pedidos").update({ andreani_tracking_number: tracking } as any).eq("id", pedidoId);
          console.info("[andreani] envio creado via MODO webhook", { pedidoId, tracking });
        }
      } catch (err) {
        console.error("[andreani] Error creando el envio post-pago:", err);
      }
    }

    if (!pedido.confirmation_email_sent_at) {
      await sendPaidOrderEmail(pedidoId);
    }
  }

  return { ok: true, estado };
}

export async function verifyModoWebhookSignature(request: Request, rawBody: string) {
  const secret = getModoConfig().webhookSecret;
  if (!secret) return true;

  const headerValue = request.headers.get("x-modo-signature") ?? request.headers.get("x-signature");
  if (!headerValue) return false;

  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeHexEqual(expected, headerValue.replace(/^sha256=/i, "").trim());
}

function getTokenExpiry(accessToken: string): number {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return Math.floor(Date.now() / 1000) + 24 * 3600;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return Number(payload?.exp ?? Math.floor(Date.now() / 1000) + 24 * 3600);
  } catch {
    return Math.floor(Date.now() / 1000) + 24 * 3600;
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