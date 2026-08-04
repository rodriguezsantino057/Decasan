# Configuracion del Calculador de Envio - Andreani

El checkout usa `src/lib/shipping.functions.ts` para cotizar envios con Andreani y siempre agrega la opcion de retiro en el local.

## Variables de entorno

Agrega estas variables a `.env.local`:

```env
ANDREANI_USERNAME=tu_usuario
ANDREANI_PASSWORD=tu_contrasena
ANDREANI_CLIENT=tu_codigo_cliente
ANDREANI_CONTRACT=tu_contrato
ANDREANI_PRODUCT_CATEGORY="Herramientas y equipamiento"
ANDREANI_DESTINATION_CITY=
ANDREANI_DEFAULT_DELIVERY_DAYS=5
ANDREANI_LOGIN_URL=https://apis.andreani.com/login
ANDREANI_QUOTE_URL=https://apis.andreanigloballpack.com/cotizador-globallpack/api/v1/Cotizador
ANDREANI_BRANCHES_URL=https://apis.andreani.com/v2/sucursales

SHIPPING_ORIGIN_CP=5172
SHIPPING_ORIGIN_CITY="La Falda"
SHIPPING_DECLARED_VALUE=1000
SHIPPING_DEFAULT_LENGTH_CM=20
SHIPPING_DEFAULT_WIDTH_CM=20
SHIPPING_DEFAULT_HEIGHT_CM=10
SHIPPING_FALLBACK_BASE=500
SHIPPING_FALLBACK_PER_KG=50
```

`ANDREANI_BRANCHES_URL` apunta al endpoint de sucursales/puntos de retiro. Si Andreani cambia el endpoint o los parametros para tu cuenta, actualizalo ahi.

## API Andreani

- Login: `GET https://apis.andreani.com/login` con Basic Auth.
- Cotizador: `GET https://apis.andreanigloballpack.com/cotizador-globallpack/api/v1/Cotizador`.
- El token de login se envia como header `x-authorization-token`.
- El cotizador requiere contrato, cliente, origen, destino y datos del bulto.

La documentacion de Andreani indica que las credenciales se solicitan siendo cliente de Andreani y que los datos de destino deben coincidir con sus localidades normalizadas.

## Fallback

Si faltan credenciales o la API no responde, se muestran tarifas fallback configurables con:

```env
SHIPPING_FALLBACK_BASE=500
SHIPPING_FALLBACK_PER_KG=50
```

## Prueba

1. Ejecuta `bun run dev`.
2. Entra a `/admin/shipping-demo`.
3. Ingresa codigo postal y peso.
4. Verifica que aparezcan retiro en local y opciones Andreani.
