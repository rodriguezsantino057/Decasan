# Configuración del Calculador de Envío - Zipnova

El checkout usa `src/lib/shipping.functions.ts` y `src/lib/zipnova.ts` para cotizar envíos con Zipnova y siempre agrega la opción de retiro en el local.

## Variables de entorno

Agrega estas variables a tu archivo `.env` o en el dashboard de hosting (Vercel):

```env
# Zipnova API v2
ZIPNOVA_TOKEN=tu_token_de_cuenta
ZIPNOVA_SECRET=tu_secret_de_cuenta
ZIPNOVA_ACCOUNT_ID=tu_account_id
ZIPNOVA_ORIGIN_ID=auto
ZIPNOVA_API_URL=https://api.zipnova.com.ar/v2
ZIPNOVA_DEFAULT_DELIVERY_DAYS=5

# Opcional: Modo Mock para desarrollo sin credenciales
ZIPNOVA_MOCK=false

# Configuración de bultos y origen
SHIPPING_ORIGIN_CP=5172
SHIPPING_ORIGIN_CITY="La Falda"
SHIPPING_PRODUCT_CATEGORY="Herramientas y equipamiento"
SHIPPING_DECLARED_VALUE=1000
SHIPPING_DEFAULT_LENGTH_CM=20
SHIPPING_DEFAULT_WIDTH_CM=20
SHIPPING_DEFAULT_HEIGHT_CM=10

# Tarifas Fallback (se usan si no hay credenciales o falla la API)
SHIPPING_FALLBACK_BASE=500
SHIPPING_FALLBACK_PER_KG=50
```

## Autenticación API Zipnova

- La API v2 de Zipnova (`https://api.zipnova.com.ar/v2`) soporta autenticación HTTP Basic (`Authorization: Basic base64(token:secret)`) utilizando `ZIPNOVA_TOKEN` como usuario y `ZIPNOVA_SECRET` como contraseña.
- Si solo se proporciona `ZIPNOVA_TOKEN`, se envía como Bearer token (`Authorization: Bearer <token>`).

## Fallback y Resiliencia

- Las tarifas fallback (`SHIPPING_FALLBACK_BASE` + (`pesoKg - 1`) * `SHIPPING_FALLBACK_PER_KG`) **solo se usan en modo mock** (`ZIPNOVA_MOCK=true`) para pruebas internas.
- En producción, si `ZIPNOVA_TOKEN`/`ZIPNOVA_SECRET` no están configurados o la API de Zipnova no responde, `getZipnovaQuote()` devuelve `null`:
  - El checkout no muestra tarifa de envío a domicilio (solo retiro en local + contacto por WhatsApp).
  - **El checkout nunca se bloquea ni muestra error al cliente final, y nunca se cobra un precio inventado.**

## Modo Mock para Pruebas

Para probar todo el flujo de compra, generación de guía y descarga de etiqueta sin tener credenciales activas de Zipnova:
1. Activa en `.env`: `ZIPNOVA_MOCK=true`.
2. Al realizar un pedido y confirmarse el pago (Mercado Pago / MODO), se generará un número de tracking mock (ej. `ZN-MOCK-123456`).
3. En el panel de administración (`/admin/pedidos`), el botón **Descargar PDF** generará y descargará una etiqueta PDF válida de prueba.

## Pruebas

1. Ejecuta `bun run dev` o `npm run dev`.
2. Entra a `/admin/shipping-demo`.
3. Ingresa tu código postal de destino.
4. Verifica que aparezcan el retiro en local y la opción de envío a domicilio calculada.

> **Nota:** La API v2 de Zipnova exige `city` y `state` en el `destination` de la cotización (además del `zipcode`). El checkout envía la ciudad y provincia que ingresa el cliente; si faltan, la cotización no se muestra (solo retiro en local + WhatsApp).
