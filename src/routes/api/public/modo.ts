import { createFileRoute } from "@tanstack/react-router";
import {
  applyModoPayment,
  getModoIntention,
  isModoConfigured,
  mapModoStatus,
  verifyModoWebhookSignature,
} from "@/lib/modo";

// MODO IPN/Webhook: https://merchants.modo.com.ar/docs
export const Route = createFileRoute("/api/public/modo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isModoConfigured()) return new Response("MODO no configurado", { status: 200 });

        let rawBody = "";
        try {
          rawBody = await request.text();
        } catch {
          rawBody = "";
        }

        const validSignature = await verifyModoWebhookSignature(request, rawBody);
        if (!validSignature) {
          console.warn("[modo] invalid webhook signature");
          return new Response("invalid signature", { status: 200 });
        }

        let payload: any = {};
        try {
          payload = JSON.parse(rawBody);
        } catch {
          /* payload vacio o no JSON */
        }

        const data = payload?.data ?? payload?.payment ?? payload;
        const intentionId = String(
          data?.intentionId ??
            data?.intention_id ??
            data?.paymentIntentId ??
            data?.id ??
            payload?.intentionId ??
            payload?.intention_id ??
            "",
        );
        if (!intentionId) {
          return new Response("ignored", { status: 200 });
        }

        try {
          let paymentPayload: Record<string, unknown> = {
            id: intentionId,
            status: String(data?.status ?? payload?.status ?? ""),
            external_intention_id:
              data?.externalIntentionId ?? data?.external_intention_id ?? payload?.externalIntentionId ?? undefined,
            transaction_amount:
              data?.transactionAmount ?? data?.amount ?? data?.price ?? payload?.amount ?? undefined,
          };

          // Si el webhook no trae un estado definido, consultamos la intencion en MODO.
          if (mapModoStatus(String(paymentPayload.status)) === "pendiente") {
            const intention = await getModoIntention(intentionId);
            if (intention.status) {
              paymentPayload = { ...paymentPayload, status: intention.status, external_intention_id: intention.externalIntentionId };
            }
          }

          const result = await applyModoPayment(paymentPayload);
          if (!result.ok) console.warn("[modo] payment ignored", { intentionId, reason: result.reason });
        } catch (error) {
          console.error("[modo] payment processing failed", {
            intentionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("MODO webhook ready", { status: 200 }),
    },
  },
});