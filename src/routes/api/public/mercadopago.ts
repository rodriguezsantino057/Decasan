import { createFileRoute } from "@tanstack/react-router";
import {
  applyMercadoPagoPayment,
  fetchMercadoPagoPayment,
  getMercadoPagoAccessToken,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercadopago";

// Mercado Pago IPN/Webhook: https://www.mercadopago.com.ar/developers
// MP envía POST con { type, data: { id } } o query params equivalentes.
export const Route = createFileRoute("/api/public/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const MP_TOKEN = getMercadoPagoAccessToken();
        if (!MP_TOKEN) return new Response("MP no configurado", { status: 200 });

        let payload: any = {};
        try { payload = await request.json(); } catch { /* MP a veces manda querystring */ }
        const url = new URL(request.url);
        const type = payload.type ?? payload.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
        const dataId = String(payload?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

        if (type !== "payment" || !dataId) {
          return new Response("ignored", { status: 200 });
        }

        const validSignature = await verifyMercadoPagoWebhookSignature(request, dataId);
        if (!validSignature) {
          console.warn("[mp] invalid webhook signature", { dataId });
          return new Response("invalid signature", { status: 200 });
        }

        try {
          const payment = await fetchMercadoPagoPayment(dataId, MP_TOKEN);
          const result = await applyMercadoPagoPayment(payment);
          if (!result.ok) console.warn("[mp] payment ignored", { dataId, reason: result.reason });
        } catch (error) {
          console.error("[mp] payment processing failed", {
            dataId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("MP webhook ready", { status: 200 }),
    },
  },
});
