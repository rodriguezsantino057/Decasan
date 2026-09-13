# Resumen de Implementación de Envíos - Zipnova

La integración de envíos queda centralizada en `src/lib/zipnova.ts` y se expone a través de `src/lib/shipping.functions.ts`.

## Qué incluye

- Cotización de envío a domicilio con Zipnova API v2 (`POST /shipments/quote`).
- Creación y despacho de envíos post-pago (`POST /shipments`).
- Descarga de etiquetas en PDF para pedidos enviados (`GET /shipments/{id}/label.pdf`).
- Autenticación HTTP Basic (`ZIPNOVA_TOKEN` / `ZIPNOVA_SECRET`) o Bearer Token.
- Variables de entorno `ZIPNOVA_*` documentadas en `.env.example`.
- Retiro en local sin costo siempre disponible.
- Tarifas de fallback (`SHIPPING_FALLBACK_BASE`, `SHIPPING_FALLBACK_PER_KG`) **solo en modo mock** para pruebas internas; en producción, si faltan credenciales o la API externa no responde, no se muestra tarifa de envío (solo retiro en local + WhatsApp) y el checkout nunca se bloquea.
- Modo Mock (`ZIPNOVA_MOCK=true`) para pruebas completas de extremo a extremo sin credenciales de producción.

## Flujo

1. El cliente ingresa su código postal en el checkout o cotizador.
2. La server function `getShippingOptions()` consulta Zipnova (o aplica el fallback solo en modo mock).
3. Se devuelven las opciones ordenadas por costo (Retiro en local y Envío a domicilio).
4. Al confirmar la compra, `orders.functions.ts` re-valida la opción y guarda el pedido con `carrier: "zipnova"`.
5. Al confirmarse el pago mediante webhook de Mercado Pago, se genera la orden en Zipnova y se asigna el `tracking_number`.
6. Desde el panel de administración (`/admin/pedidos`), el administrador puede ver el número de tracking y descargar la etiqueta en PDF.

## Archivos principales

- `src/lib/zipnova.ts`
- `src/lib/shipping.functions.ts`
- `src/lib/orders.functions.ts`
- `src/lib/admin.functions.ts`
- `src/lib/mercadopago.ts`
- `src/routes/_authenticated.admin.pedidos.tsx`
- `src/routes/admin.shipping-demo.tsx`
- `SHIPPING_SETUP.md`
