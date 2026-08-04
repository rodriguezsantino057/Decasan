# Resumen de Implementacion de Envios - Andreani

La integracion de envios queda centralizada en `src/lib/shipping.functions.ts`.

## Que incluye

- Cotizacion de envio a domicilio con Andreani.
- Login con credenciales Andreani y uso de `x-authorization-token`.
- Variables de entorno `ANDREANI_*`.
- Retiro en local sin costo.
- Soporte opcional para sucursales/puntos de retiro si se configura `ANDREANI_BRANCHES_URL`.
- Tarifas fallback para no bloquear el checkout si faltan credenciales o Andreani no responde.

## Flujo

1. El cliente ingresa codigo postal en checkout.
2. El server function `calculateShipping()` consulta Andreani.
3. Se devuelve retiro en local, sucursales opcionales y envio Andreani a domicilio.
4. Al crear la orden, `selectShippingOption()` vuelve a validar el metodo y precio en servidor.

## Archivos principales

- `src/lib/shipping.functions.ts`
- `src/components/ShippingCalculator.tsx`
- `src/routes/checkout.tsx`
- `src/routes/admin.shipping-demo.tsx`
- `.env.example`
- `SHIPPING_SETUP.md`
