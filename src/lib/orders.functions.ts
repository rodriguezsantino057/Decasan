import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOCAL_PICKUP_CODE, TRANSPORTISTA_LABEL } from "@/lib/shipping.functions";
import { assertValidPublicBaseUrl, getMercadoPagoAccessToken, getPublicBaseUrl } from "@/lib/mercadopago";

const itemSchema = z.object({
  id: z.number().int().positive(),
  qty: z.number().int().positive().max(999),
});

const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  email: z.string().email(),
  nombre: z.string().trim().min(1).max(120),
  telefono: z.string().trim().min(1).max(40),
  direccion: z.object({
    calle: z.string().trim().max(120).optional().nullable(),
    numero: z.string().trim().max(20).optional().nullable(),
    piso: z.string().trim().max(20).optional().nullable(),
    ciudad: z.string().trim().max(80).optional().nullable(),
    provincia: z.string().trim().max(80).optional().nullable(),
    codigo_postal: z.string().trim().max(8).optional().nullable(),
  }),
  envio: z.object({
    shipping_option_id: z.string().uuid(),
  }),
  pago: z.object({
    metodo: z.enum(["transferencia_mp", "tarjeta", "efectivo"]),
  }),
  notas: z.string().max(500).optional().nullable(),
});

const PAYMENT_LABELS = {
  transferencia_mp: "Transferencia por Mercado Pago",
  tarjeta: "Tarjeta por Mercado Pago",
  efectivo: "Efectivo al retirar (a convenir)",
} as const;

type ProductForOrder = {
  id: number;
  nombre: string | null;
  sku: string | null;
  precio: number | null;
  precio_oferta: number | null;
  oferta_hasta: string | null;
  activo: boolean | null;
  stock: number | null;
};

export const createOrderAndPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const requestId = crypto.randomUUID();

    console.info("[orders] creating order", {
      requestId,
      userId,
      itemCount: data.items.length,
      destinoCp: data.direccion.codigo_postal,
      shippingOptionId: data.envio.shipping_option_id,
      paymentMethod: data.pago.metodo,
    });

    const shipping = await getActiveShippingOption(data.envio.shipping_option_id);
    const isLocalPickup = shipping.codigo_servicio === LOCAL_PICKUP_CODE;
    if (!isLocalPickup) validateShippingAddress(data.direccion);
    
    if (data.pago.metodo === "efectivo" && !isLocalPickup) {
      throw new Error("El pago en efectivo solo esta disponible con retiro en local");
    }
    if (shipping.provincia && normalizeProvince(shipping.provincia) !== normalizeProvince(data.direccion.provincia ?? "")) {
      throw new Error("La opcion de envio no corresponde a la provincia indicada");
    }

    const ids = [...new Set(data.items.map((item) => item.id))];
    const { data: products, error: productError } = await supabaseAdmin
      .from("productos")
      .select("id,nombre,sku,precio,precio_oferta,oferta_hasta,activo,stock")
      .in("id", ids);

    if (productError) {
      console.error("[orders] product validation failed", { requestId, error: productError.message });
      throw new Error("No se pudieron validar los productos");
    }

    const productsById = new Map((products ?? []).map((product) => [product.id, product as ProductForOrder]));
    const validatedItems = data.items.map((item) => {
      const product = productsById.get(item.id);
      if (!product || !product.activo) {
        console.warn("[orders] inactive or missing product", { requestId, productId: item.id });
        throw new Error("Uno de los productos ya no esta disponible");
      }
      if (product.stock != null && product.stock < item.qty) {
        console.warn("[orders] insufficient stock", { requestId, productId: item.id, stock: product.stock, qty: item.qty });
        throw new Error(`No hay stock suficiente para ${product.nombre ?? "un producto"}`);
      }

      const unitPrice = getEffectivePrice(product);
      if (unitPrice <= 0) {
        console.warn("[orders] invalid product price", { requestId, productId: item.id, unitPrice });
        throw new Error(`El producto ${product.nombre ?? item.id} no tiene precio valido`);
      }

      return {
        id: product.id,
        nombre: product.nombre ?? `Producto ${product.id}`,
        sku: product.sku,
        precio_unitario: unitPrice,
        cantidad: item.qty,
        subtotal: roundMoney(unitPrice * item.qty),
      };
    });

    const productsSubtotal = roundMoney(validatedItems.reduce((sum, item) => sum + item.subtotal, 0));
    const shippingTotal = roundMoney(shipping.precio);
    const total = roundMoney(productsSubtotal + shippingTotal);

    console.info("[orders] totals validated", {
      requestId,
      productsSubtotal,
      shippingTotal,
      total,
      shippingOptionId: shipping.id,
    });

    const MP_TOKEN = getMercadoPagoAccessToken();
    const origin = getPublicBaseUrl();
    if (MP_TOKEN) assertValidPublicBaseUrl(origin);

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        user_id: userId,
        estado: "pendiente",
        subtotal_productos: productsSubtotal,
        envio_total: shippingTotal,
        envio_metodo: shipping,
        shipping_option_id: shipping.id,
        costo_envio: shippingTotal,
        transportista: shipping.transportista,
        total,
        email: data.email,
        nombre: data.nombre,
        telefono: data.telefono,
        direccion: isLocalPickup ? null : data.direccion,
        notas: buildOrderNotes(data.pago.metodo, data.notas),
      } as any)
      .select()
      .single();
    if (error || !pedido) {
      console.error("[orders] order insert failed", { requestId, error: error?.message });
      throw new Error(error?.message ?? "No se pudo crear el pedido");
    }

    const orderItems = validatedItems.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.id,
      nombre: item.nombre,
      sku: item.sku ?? null,
      precio_unitario: item.precio_unitario,
      cantidad: item.cantidad,
      subtotal: item.subtotal,
    }));
    const { error: itemError } = await supabase.from("pedido_items").insert(orderItems);
    if (itemError) {
      console.error("[orders] order items insert failed", { requestId, pedidoId: pedido.id, error: itemError.message });
      throw new Error(itemError.message);
    }

    if (data.pago.metodo === "efectivo") {
      console.info("[orders] order created for cash payment", { requestId, pedidoId: pedido.id });
      return {
        pedidoId: pedido.id,
        total,
        initPoint: null,
        sandboxInitPoint: null,
        mpConfigured: false,
        paymentMethod: data.pago.metodo,
      };
    }

    if (!MP_TOKEN) {
      console.warn("[orders] Mercado Pago token missing", { requestId, pedidoId: pedido.id });
      return {
        pedidoId: pedido.id,
        total,
        initPoint: null,
        sandboxInitPoint: null,
        mpConfigured: false,
        paymentMethod: data.pago.metodo,
      };
    }

    // Configure exclusions to force bank transfer (debin/QR) or cards
    const paymentMethodsConfig: any = {};
    if (data.pago.metodo === "tarjeta") {
      paymentMethodsConfig.excluded_payment_types = [
        { id: "bank_transfer" },
        { id: "ticket" }
      ];
    } else if (data.pago.metodo === "transferencia_mp") {
      paymentMethodsConfig.excluded_payment_types = [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "prepaid_card" },
        { id: "ticket" }
      ];
    }

    const prefBody = {
      items: [
        ...validatedItems.map((item) => ({
          title: item.nombre.slice(0, 250),
          quantity: item.cantidad,
          currency_id: "ARS",
          unit_price: item.precio_unitario,
        })),
        ...(shippingTotal > 0
          ? [
              {
                title: shipping.descripcion.slice(0, 250),
                quantity: 1,
                currency_id: "ARS",
                unit_price: shippingTotal,
              },
            ]
          : []),
      ],
      payer: { email: data.email, name: data.nombre },
      external_reference: pedido.id,
      metadata: {
        payment_method: data.pago.metodo,
        payment_label: PAYMENT_LABELS[data.pago.metodo],
      },
      payment_methods: paymentMethodsConfig,
      back_urls: {
        success: `${origin}/cuenta?pedido=${pedido.id}`,
        failure: `${origin}/checkout?pedido=${pedido.id}`,
        pending: `${origin}/cuenta?pedido=${pedido.id}`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/public/mercadopago?source_news=webhooks`,
    };

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_TOKEN}` },
      body: JSON.stringify(prefBody),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error("[orders] MP preference error", { requestId, pedidoId: pedido.id, status: resp.status, body: text });
      return {
        pedidoId: pedido.id,
        total,
        initPoint: null,
        sandboxInitPoint: null,
        mpConfigured: true,
        paymentMethod: data.pago.metodo,
        error: "Mercado Pago no respondio correctamente",
      };
    }

    const pref = await resp.json();
    await supabaseAdmin.from("pedidos").update({ mp_preference_id: pref.id }).eq("id", pedido.id);

    console.info("[orders] MP preference created", { requestId, pedidoId: pedido.id, preferenceId: pref.id });

    return {
      pedidoId: pedido.id,
      total,
      initPoint: pref.init_point as string,
      sandboxInitPoint: pref.sandbox_init_point as string,
      mpConfigured: true,
      paymentMethod: data.pago.metodo,
    };
  });

async function getActiveShippingOption(id: string) {
  const { data, error } = await supabaseAdmin
    .from("shipping_options")
    .select("id, transportista, provincia, costo, label, dias_estimados_min, dias_estimados_max, activo")
    .eq("id", id)
    .single();

  if (error || !data || !data.activo) {
    console.warn("[orders] invalid shipping option", { id, error: error?.message });
    throw new Error("La opcion de envio seleccionada ya no esta disponible");
  }

  const transportista = data.transportista as keyof typeof TRANSPORTISTA_LABEL;
  const costo = roundMoney(Number(data.costo));
  const isLocalPickup = transportista === "retiro_local";

  return {
    id: data.id,
    transportista,
    provincia: data.provincia,
    costo,
    label: data.label,
    dias_estimados_min: data.dias_estimados_min,
    dias_estimados_max: data.dias_estimados_max,
    codigo_servicio: isLocalPickup ? LOCAL_PICKUP_CODE : data.id,
    servicio: TRANSPORTISTA_LABEL[transportista],
    descripcion: data.label,
    dias_habiles: data.dias_estimados_max ?? data.dias_estimados_min ?? 0,
    precio: costo,
    tipo: isLocalPickup ? "local" : "domicilio",
  };
}

function validateShippingAddress(direccion: z.infer<typeof createOrderSchema>["direccion"]) {
  if (!direccion.calle?.trim()) throw new Error("Ingresa la calle para el envio");
  if (!direccion.ciudad?.trim()) throw new Error("Ingresa la ciudad para el envio");
  if (!direccion.provincia?.trim()) throw new Error("Ingresa la provincia para el envio");
  if (!direccion.codigo_postal?.trim() || !/^\d{4,8}$/.test(direccion.codigo_postal)) {
    throw new Error("Ingresa un codigo postal valido para el envio");
  }
}

function getEffectivePrice(product: ProductForOrder): number {
  const base = Number(product.precio ?? 0);
  const offer = Number(product.precio_oferta ?? 0);
  if (offer > 0 && (!product.oferta_hasta || new Date(product.oferta_hasta) > new Date())) {
    return roundMoney(offer);
  }
  return roundMoney(base);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildOrderNotes(paymentMethod: keyof typeof PAYMENT_LABELS, notes: string | null | undefined) {
  const paymentNote = `Metodo de pago: ${PAYMENT_LABELS[paymentMethod]}`;
  const trimmedNotes = notes?.trim();
  return trimmedNotes ? `${paymentNote}\n${trimmedNotes}` : paymentNote;
}

function normalizeProvince(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
